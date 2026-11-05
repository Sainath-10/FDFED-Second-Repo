import { Injectable, BadRequestException, ForbiddenException, NotFoundException, HttpException, HttpStatus, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CompetitionEntity as Competition } from '../../entities/competition.entity';
import { PaymentTransactionEntity as Transaction } from '../../entities/payment-transaction.entity';
import { EscrowAccountEntity as Escrow } from '../../entities/escrow-account.entity';
import { PaymentMailEntity as Mail } from '../../entities/payment-mail.entity';
import { TeamEntity as Team } from '../../entities/team.entity';
import { UserEntity as User } from '../../entities/user.entity';
import { MatchEntity as Match } from '../../entities/match.entity';
import { DisputeEntity as Dispute } from '../../entities/dispute.entity';
import { TeamJoinRequestEntity as JoinRequest } from '../../entities/team-join-request.entity';
import { TeamInviteEntity as Invite } from '../../entities/team-invite.entity';
import { NotificationEntity as Notification } from '../../entities/notification.entity';
import { AdminActivityLogEntity as Audit } from '../../entities/admin-activity-log.entity';
import { UserRole, DisputeStatus } from '../../common/interfaces';
import { TERMINAL_PAYMENT_STATES, TRUST_PENALTY_CANCEL, TRUST_PENALTY_FRAUD, mailSubject, prizeDeadline, allocatePrizes, standingsGroups, DEFAULT_MIN_ORGANIZER_TRUST } from './payment.rules';
import { CompetitionRemovalEntity } from '../../entities/competition-removal.entity';
import { isEligiblePlayerAccount } from '../../common/validation/player-eligibility';
import { computeStandings } from '../../common/tournament/tournament.utils';

const PLAYOFF_ROUNDS = ['Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final'];

export const managed = (c: any) => !!c?.paymentStatus && c.paymentStatus !== 'LEGACY';
const terminal = (c: Competition) => TERMINAL_PAYMENT_STATES.includes(c.paymentStatus);
const activeTeam = (t: Team) => !['banned', 'rejected', 'disbanded'].includes(t.status);
const minor = (amount: number) => {
  const n = Math.round(Number(amount || 0) * 100);
  if (!Number.isSafeInteger(n) || n < 0 || n > 2147483647) throw new BadRequestException('Invalid amount');
  return n;
};
const inr = (amountMinor: number) => `₹${(amountMinor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const financeRole = (u: any) => ['finance_moderator', 'admin', 'super_admin'].includes(u?.role);

/**
 * Mock escrow lifecycle (Payment_Architecture.md §2–§9). Every money movement is
 * a ledger row; no gateway is contacted. Each operation runs in one database
 * transaction holding a per-competition advisory lock, so retries and
 * concurrent clicks cannot double-charge, double-refund or double-release.
 */
@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private running = false;
  private logger = new Logger(LifecycleService.name);
  constructor(private db: DataSource, private config: ConfigService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.runDeadlines().catch(error => this.logger.error(error.message)), 60000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  private mock() {
    if (this.config.get('PAYMENT_PROVIDER', 'mock') !== 'mock' || this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('This lifecycle is available only in local mock payment mode.');
    }
  }
  private owner(c: Competition, user: any) {
    if (c.createdBy !== user.username && !(c.organizers || []).includes(user.username)) {
      throw new ForbiddenException('Only this competition’s organizers can do this.');
    }
  }
  deadline(c: Competition) {
    return prizeDeadline(c.startDate, Number(this.config.get('AUTO_CANCEL_HOURS_BEFORE_START', 0)));
  }
  private async locked<T>(id: string, work: (m: EntityManager, c: Competition) => Promise<T>): Promise<T> {
    this.mock();
    return this.db.transaction(async m => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
      const c = await m.findOne(Competition, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!c) throw new NotFoundException('Competition not found');
      if (!managed(c)) throw new BadRequestException('Legacy competitions do not have a payment escrow ledger.');
      return work(m, c);
    });
  }
  private open(c: Competition) {
    const now = Date.now();
    if (!c.organizerPaid || terminal(c) || c.paymentStatus === 'COMPLETED' || c.status === 'completed') throw new BadRequestException('Competition is not accepting registrations.');
    if (now >= +new Date(c.startDate) || (c.registrationCloseAt && now >= +new Date(c.registrationCloseAt)) || (c.registrationOpenAt && now < +new Date(c.registrationOpenAt))) {
      throw new BadRequestException('Registration window is closed.');
    }
  }
  private async escrow(m: EntityManager, c: Competition) {
    let e = await m.findOneBy(Escrow, { competitionId: c.id });
    if (!e) e = await m.save(m.create(Escrow, { competitionId: c.id }));
    return e;
  }

  /** Records a simulated email (idempotent per event key) plus an in-app notification. */
  async notify(m: EntityManager, c: Competition, username: string, template: string, key: string, body: string) {
    if (!username) return;
    const eventKey = `${c.id}:${template}:${key}:${username}`;
    if (await m.existsBy(Mail, { eventKey })) return;
    const subject = mailSubject(template, c.name);
    await m.save(m.create(Mail, { eventKey, competitionId: c.id, username, template, subject, body: `Hi @${username},\n\n${body}\n\n— The NEXUS Platform Team` }));
    // Informational: nothing awaits an answer, so it never shows as "pending" in the notifications page.
    await m.save(m.create(Notification, { toUsername: username, type: template, status: 'info', title: subject, body, meta: { compId: c.id, compName: c.name, category: 'payment', mock: true } }));
  }
  private async audit(m: EntityManager, c: Competition, actor: string, action: string, reason: string) {
    await m.save(m.create(Audit, { adminUsername: actor, actionType: action, details: reason, metadata: { competitionId: c.id, competitionName: c.name, mock: true } }));
  }
  private async entry(m: EntityManager, c: Competition, type: string, key: string, username: string, amount: number, direction = 'IN', teamId?: string, status?: string) {
    let tx = await m.findOneBy(Transaction, { competitionId: c.id, type, subjectKey: key });
    if (tx) return tx;
    tx = await m.save(m.create(Transaction, {
      competitionId: c.id, type, subjectKey: key, userUsername: username, amountMinor: amount, currency: 'INR', direction, teamId,
      status: status || (direction === 'IN' ? 'ESCROWED' : 'CONFIRMED'), paidAt: new Date(),
    }));
    tx.gatewayOrderId = `mock_order_${tx.id}`;
    tx.gatewayRefId = `mock_pay_${tx.id}`;
    return m.save(tx);
  }
  private async verified(m: EntityManager, username: string, competitionId: string) {
    const user = await m.findOneBy(User, { username });
    if (!user || user.banned) throw new ForbiddenException('An active, non-banned account is required.');
    if (!isEligiblePlayerAccount(user)) throw new ForbiddenException('Staff accounts cannot join a competition team.');
    const removals = await m.find(CompetitionRemovalEntity, { where: { competitionId } });
    if (removals.some(removal => removal.username.toLowerCase() === username.toLowerCase())) {
      throw new ForbiddenException('You have been removed from this competition.');
    }
    return user;
  }
  private async penalize(m: EntityManager, username: string, points: number) {
    const owner = await m.findOneBy(User, { username });
    if (owner) { owner.organizerTrustScore = Math.max(0, Number(owner.organizerTrustScore ?? 100) - points); await m.save(owner); }
  }

  private async fee(m: EntityManager, c: Competition, team: Team, username: string, key: string, amount: number) {
    const prior = await m.findOneBy(Transaction, { competitionId: c.id, type: 'REGISTRATION', subjectKey: key });
    if (prior) {
      if (prior.status !== 'ESCROWED') throw new BadRequestException('This registration was already settled.');
      return;
    }
    await this.entry(m, c, 'REGISTRATION', key, username, amount, 'IN', team.id);
    const e = await this.escrow(m, c);
    e.registrationsMinor += amount; e.balanceMinor += amount;
    await m.save(e);
    await this.notify(m, c, username, 'registration-confirmed', key,
      `Your registration for team ${team.name} is confirmed.\nAmount paid: ${inr(amount)} (held in escrow, not paid to the organizer).\n\nRefund policy: if the organizer cancels or abandons the competition, your registration fee is refunded in full.`);
    await this.notify(m, c, c.createdBy, 'new-team-joined', key,
      `@${username} registered with team ${team.name}. Registration fees stay in escrow until the competition is settled.`);
  }

  async prize(id: string, user: any, outcome = 'success') {
    return this.locked(id, async (m, c) => {
      this.owner(c, user);
      if (c.prizePoolPaid) return { duplicate: true };
      if (!c.organizerPaid || terminal(c) || +this.deadline(c) <= Date.now()) {
        throw new BadRequestException('The prize pool can be funded only after publication and before the funding deadline.');
      }
      if (outcome === 'failed') return { status: 'FAILED', mock: true };
      const amount = minor(c.prize);
      await this.entry(m, c, 'PRIZE_POOL', '', user.username, amount);
      const e = await this.escrow(m, c);
      e.prizeMinor += amount; e.balanceMinor += amount;
      await m.save(e);
      c.prizePoolPaid = true; c.prizePoolPaidAt = new Date();
      await m.save(c);
      await this.notify(m, c, c.createdBy, 'prize-pool-confirmed', '',
        `${inr(amount)} is now locked in escrow as the prize pool. Players are protected: it can only be released to verified winners.`);
      return { status: 'ESCROWED', amountMinor: amount, mock: true };
    });
  }

  async registerTeam(dto: any, user: any) {
    return this.locked(dto.competitionId, async (m, c) => {
      this.open(c);
      const payer = await this.verified(m, user.username, c.id);
      if ([c.createdBy, ...c.organizers].includes(user.username)) throw new BadRequestException('Organizers cannot register in their own competition.');
      if (c.visibility === 'private' && String(dto.joinCode || '').toUpperCase() !== c.joinCode?.toUpperCase()) throw new BadRequestException('Invalid join code');
      const teams = await m.find(Team, { where: { competitionId: c.id } });
      const current = teams.filter(activeTeam);
      const prior = current.find(t => t.leaderId === user.username);
      if (prior) return prior; // retry after a lost response
      if (c.maxTeams && current.length >= c.maxTeams) throw new BadRequestException('Team capacity is full.');
      const members = Array.from(new Set<string>([user.username, ...(dto.members || [])]));
      if (c.feeType === 'per_player' && members.length > 1) throw new BadRequestException('Each player must accept an invitation or pay their own join request.');
      if (c.maxPlayersPerTeam && members.length > c.maxPlayersPerTeam) throw new BadRequestException('Team is full');
      for (const name of members) {
        await this.verified(m, name, c.id);
        if (current.some(t => t.memberUsernames.includes(name))) throw new BadRequestException(`${name} is already in a team.`);
      }
      if (String(dto.name || '').trim().length < 3) throw new BadRequestException('Team name must be at least 3 characters.');
      const team = await m.save(m.create(Team, { name: dto.name.trim(), competitionId: c.id, leaderId: user.username, leaderUsername: user.username, createdBy: user.username, memberUsernames: members, status: 'approved' }));
      const amount = c.feeType === 'free' ? 0 : minor(c.entryFeeAmount);
      await this.fee(m, c, team, user.username, c.feeType === 'per_player' ? user.username : team.id, amount);
      if (payer.role === UserRole.PARTICIPANT) { payer.role = UserRole.TEAM_LEAD; await m.save(payer); }
      return team;
    });
  }

  async join(requestId: string, user: any, invitation = false) {
    const reference = invitation ? await this.db.getRepository(Invite).findOneBy({ id: requestId }) : await this.db.getRepository(JoinRequest).findOneBy({ id: requestId });
    if (!reference) throw new NotFoundException('Request not found');
    return this.locked(reference.competitionId, async (m, c) => {
      this.open(c);
      await this.verified(m, user.username, c.id);
      const request: any = invitation ? await m.findOneBy(Invite, { id: requestId }) : await m.findOneBy(JoinRequest, { id: requestId });
      if ((invitation ? request.toUsername : request.fromUsername) !== user.username) throw new ForbiddenException('This request belongs to another player.');
      const team = await m.findOneBy(Team, { id: request.teamId });
      if (!team || !activeTeam(team)) throw new BadRequestException('Team is not accepting players.');
      if (['paid', 'accepted'].includes(request.status) && team.memberUsernames.includes(user.username)) return { ...request, team };
      if (request.status !== (invitation ? 'pending' : 'awaiting_payment')) throw new BadRequestException('Request is not ready for payment.');
      if (c.maxPlayersPerTeam && team.memberUsernames.length >= c.maxPlayersPerTeam) throw new BadRequestException('Team is full.');
      const teams = await m.find(Team, { where: { competitionId: c.id } });
      if (teams.some(t => activeTeam(t) && t.memberUsernames.includes(user.username))) throw new BadRequestException('You already belong to a team.');
      if ([c.createdBy, ...c.organizers].includes(user.username)) throw new BadRequestException('Organizers cannot participate.');
      if (c.feeType === 'per_player') await this.fee(m, c, team, user.username, user.username, minor(c.entryFeeAmount));
      team.memberUsernames.push(user.username);
      await m.save(team);
      request.status = invitation ? 'accepted' : 'paid';
      await m.save(request);
      return { ...request, team, amount: c.feeType === 'per_player' ? c.entryFeeAmount : 0 };
    });
  }

  private async refund(m: EntityManager, c: Competition, tx: Transaction, reason: string, template = 'refund-apology') {
    if (tx.status !== 'ESCROWED') return;
    const refund = tx.amountMinor > 0 ? await this.entry(m, c, 'REFUND', tx.id, tx.userUsername, tx.amountMinor, 'OUT', tx.teamId) : null;
    tx.status = 'REFUNDED';
    await m.save(tx);
    const e = await this.escrow(m, c);
    e.balanceMinor -= tx.amountMinor; e.refundsMinor += tx.amountMinor;
    await m.save(e);
    if (!refund) {
      await this.notify(m, c, tx.userUsername, template === 'refund-apology' ? 'competition-cancelled-player' : template, tx.id, `Reason: ${reason}.\nNo registration fee was charged, so no refund is needed.`);
      return;
    }
    const body = template === 'refund-apology'
      ? `We sincerely apologise for the inconvenience. "${c.name}" has been cancelled.\nReason: ${reason}.\n\nYour registration fee of ${inr(tx.amountMinor)} has been refunded in full (mock — no bank transfer occurs).\nTransaction reference: ${refund.gatewayRefId}\n\nThe organizer has been penalised and their platform fee forfeited.`
      : `Your registration fee of ${inr(tx.amountMinor)} has been refunded in full (mock — no bank transfer occurs).\nReason: ${reason}.\nTransaction reference: ${refund.gatewayRefId}`;
    await this.notify(m, c, tx.userUsername, template, tx.id, body);
  }

  async disband(teamId: string, user: any, reason: string) {
    const existing = await this.db.getRepository(Team).findOneBy({ id: teamId });
    if (!existing) throw new NotFoundException('Team not found');
    return this.locked(existing.competitionId, async (m, c) => {
      const team = await m.findOneBy(Team, { id: teamId });
      if (team.leaderId !== user.username) throw new ForbiddenException('Only the captain can disband.');
      if (team.status === 'disbanded') return team;
      this.open(c);
      for (const tx of await m.find(Transaction, { where: { competitionId: c.id, type: 'REGISTRATION', teamId } })) await this.refund(m, c, tx, reason, 'registration-refunded');
      team.status = 'disbanded';
      await m.save(team);
      await this.audit(m, c, user.username, 'TEAM_DISBANDED', reason);
      return team;
    });
  }

  /**
   * Finance must be neutral: a moderator who organizes or plays in a competition
   * cannot settle, hold, cancel, compensate or reverse it.
   */
  private async assertNeutral(m: EntityManager, c: Competition, user: any) {
    if (user.username === 'system') return;
    if ([c.createdBy, ...(c.organizers || [])].includes(user.username)) {
      throw new ForbiddenException('Conflict of interest: you organize this competition. Another finance moderator must handle it.');
    }
    const teams = await m.find(Team, { where: { competitionId: c.id } });
    if (teams.some(t => (t.memberUsernames || []).includes(user.username))) {
      throw new ForbiddenException('Conflict of interest: you play in this competition. Another finance moderator must handle it.');
    }
  }
  /** Finance acts on someone else's competition; an organizer acts on their own. */
  private actingAsFinance(c: Competition, user: any) {
    const isOrganizer = [c.createdBy, ...(c.organizers || [])].includes(user.username);
    return user.username === 'system' || (financeRole(user) && !isOrganizer);
  }
  disputeWindowEndsAt(c: Competition) {
    if (!c.endedAt) return null;
    return new Date(+new Date(c.endedAt) + Number(this.config.get('DISPUTE_WINDOW_HOURS', 24)) * 3600000);
  }

  /**
   * The organizer (or a competition admin) removes a team. In a payment-managed
   * competition the team's fees are always refunded, so an organizer can never
   * profit from banning or rejecting paying teams.
   */
  async removeTeam(teamId: string, user: any, status: 'banned' | 'rejected', reason: string) {
    const existing = await this.db.getRepository(Team).findOneBy({ id: teamId });
    if (!existing) throw new NotFoundException('Team not found');
    return this.locked(existing.competitionId, async (m, c) => {
      const team = await m.findOneBy(Team, { id: teamId });
      if (!activeTeam(team)) return team;
      if (c.paymentStatus === 'COMPLETED' || terminal(c)) {
        throw new BadRequestException('Results are final. Raise a dispute so finance can review this team instead.');
      }
      for (const tx of await m.find(Transaction, { where: { competitionId: c.id, type: 'REGISTRATION', teamId } })) {
        await this.refund(m, c, tx, `Team ${team.name} was ${status} by the organizer: ${reason}`, 'registration-refunded');
      }
      team.status = status;
      await m.save(team);
      await this.audit(m, c, user.username, 'TEAM_REMOVED_REFUNDED', `${team.name} ${status}: ${reason}`);
      return team;
    });
  }

  async cancel(id: string, user: any, reason: string) {
    return this.locked(id, async (m, c) => {
      const finance = this.actingAsFinance(c, user);
      if (finance) await this.assertNeutral(m, c, user);
      else this.owner(c, user);
      if (terminal(c)) return { duplicate: true };
      if (c.paymentStatus === 'COMPLETED' && !finance) {
        throw new ForbiddenException('Results are final. Only a finance moderator can cancel a completed competition.');
      }

      // Unpaid draft: nothing was charged, so nothing is forfeited or penalised.
      if (!c.organizerPaid) {
        const pending = await m.findOneBy(Transaction, { competitionId: id, type: 'PLATFORM_FEE' });
        if (pending && pending.status === 'PENDING') { pending.status = 'FAILED'; await m.save(pending); }
        c.paymentStatus = 'CANCELLED'; c.status = 'cancelled'; c.abandonedReason = reason; c.endedAt = new Date();
        await m.save(c);
        await this.audit(m, c, user.username, 'DRAFT_CANCELLED', reason);
        return { status: c.paymentStatus };
      }

      const txs = await m.find(Transaction, { where: { competitionId: id, type: 'REGISTRATION' } });
      const exposed = txs.filter(tx => tx.status === 'ESCROWED');
      for (const tx of exposed) await this.refund(m, c, tx, reason);
      const e = await this.escrow(m, c); // re-read after refunds updated it
      // No players were exposed: the deposited prize pool goes back to the organizer.
      if (!exposed.length && e.prizeMinor > 0) {
        await this.entry(m, c, 'PRIZE_RETURN', '', c.createdBy, e.prizeMinor, 'OUT');
        e.balanceMinor -= e.prizeMinor; e.refundsMinor += e.prizeMinor;
      }
      e.status = e.balanceMinor > 0 ? 'HELD' : 'REFUNDED';
      await m.save(e);
      c.paymentStatus = 'REFUND_ISSUED'; c.status = 'cancelled'; c.abandonedReason = reason; c.endedAt = new Date();
      await m.save(c);
      await this.penalize(m, c.createdBy, TRUST_PENALTY_CANCEL);
      await this.notify(m, c, c.createdBy, 'competition-cancelled-organizer', '',
        `"${c.name}" has been cancelled.\nReason: ${reason}.\n\nAll registration fees have been refunded to players. Your platform fee is non-refundable and your organizer trust score was reduced by ${TRUST_PENALTY_CANCEL}.${e.status === 'HELD' ? `\nYour deposited prize pool (${inr(e.balanceMinor)}) is held for finance review.` : ''}`);
      await this.audit(m, c, user.username, 'COMPETITION_CANCELLED', reason);
      return { status: c.paymentStatus, escrow: e };
    });
  }

  private isFinal(x: Match) {
    return x.round === 'Final' || (x.bracket?.version === 2 && !x.bracket?.nextMatchId);
  }
  private isLeague(c: Competition) {
    const type = String(c.type || '').toLowerCase();
    const format = String(c.format || '').toLowerCase();
    return type === 'league' || /league|robin|playoff/.test(format);
  }

  /**
   * Ranks teams from verified results, as groups of tied teams, and checks the
   * fixtures are genuine (every active team scheduled, every match finished).
   *
   * - Knockout: final winner, runner-up, then each earlier round's losers tied.
   * - League: the standings table (3 pts win, 1 draw; then wins). Teams level on
   *   both are tied and share the prizes for the places they occupy.
   * - League with playoffs: playoff results decide the top places, the table the rest.
   */
  private async rankGroups(m: EntityManager, c: Competition) {
    const matches = await m.find(Match, { where: { competitionId: c.id } });
    if (!matches.length || matches.some(x => !['completed', 'bye'].includes(x.status))) throw new BadRequestException('Complete all fixtures before ending the competition.');
    const teams = await m.find(Team, { where: { competitionId: c.id } });
    const activeTeams = teams.filter(activeTeam);
    const active = new Set(activeTeams.map(t => t.id));
    const scheduled = new Set(matches.flatMap(x => [x.team1Id, x.team2Id]).filter(Boolean));
    const unscheduled = activeTeams.filter(t => !scheduled.has(t.id));
    if (unscheduled.length) throw new BadRequestException(`${unscheduled.map(t => t.name).join(', ')} never appeared in the fixtures. Every registered team must be scheduled before settlement.`);

    const league = this.isLeague(c);
    const leagueMatches = matches.filter(x => x.status === 'completed' && !PLAYOFF_ROUNDS.includes(x.round) && x.bracket?.kind !== 'ipl' && !(x.bracket?.version === 2));
    const tableGroups = (ids: string[]) => {
      const byName = new Map(activeTeams.filter(t => ids.includes(t.id)).map(t => [t.name, t.id]));
      return standingsGroups(computeStandings([...byName.keys()], leagueMatches as any), row => byName.get(row.team));
    };

    const hasFinal = matches.some(x => this.isFinal(x));
    if (league && !hasFinal) return { groups: tableGroups([...active]), teams, matches };

    const finals = matches.filter(x => this.isFinal(x) && x.status === 'completed');
    if (finals.length !== 1) throw new BadRequestException(`Exactly one completed final is required (found ${finals.length}).`);
    const final = finals[0];
    if (!final.winnerId) throw new BadRequestException('The final needs a winner.');
    if (![final.team1Id, final.team2Id].every(t => active.has(t))) throw new BadRequestException('The final includes a team that is not an active registered team of this competition.');
    const loser = (x: Match) => (x.winnerId === x.team1Id ? x.team2Id : x.team1Id);
    const groups: string[][] = [[final.winnerId], [loser(final)]];
    const ranked = new Set(groups.flat());
    const add = (ids: string[]) => {
      const fresh = Array.from(new Set(ids.filter(id => id && active.has(id) && !ranked.has(id))));
      if (fresh.length) { groups.push(fresh); fresh.forEach(id => ranked.add(id)); }
    };
    // IPL playoffs: places 3 and 4 are the losers of Qualifier 2 and the Eliminator.
    for (const round of ['Qualifier 2', 'Eliminator']) {
      const match = matches.find(x => x.round === round && x.winnerId);
      if (match) add([loser(match)]);
    }
    // Knockout bracket: each earlier round's losers share the next places (no invented ranking).
    let level = [final.id];
    while (level.length) {
      const feeders = matches.filter(x => x.bracket?.nextMatchId && level.includes(x.bracket.nextMatchId));
      add(feeders.filter(x => x.status === 'completed' && x.winnerId).map(loser));
      level = feeders.map(x => x.id);
    }
    // League with playoffs: everyone else is ranked by the league table.
    if (league) tableGroups([...active].filter(id => !ranked.has(id))).forEach(add);
    return { groups, teams, matches };
  }

  async end(id: string, user: any) {
    return this.locked(id, async (m, c) => {
      if (this.actingAsFinance(c, user)) await this.assertNeutral(m, c, user);
      else this.owner(c, user);
      if (c.paymentStatus === 'PRIZE_RELEASED' || c.paymentStatus === 'COMPLETED') return c;
      if (terminal(c) || !c.organizerPaid) throw new BadRequestException('This competition can no longer be ended.');
      if (!c.prizePoolPaid) throw new HttpException('Pay the prize pool to end this competition.', HttpStatus.PAYMENT_REQUIRED);
      if (+new Date(c.startDate) > Date.now()) throw new BadRequestException('Competition has not started.');
      await this.rankGroups(m, c);
      c.status = 'completed'; c.paymentStatus = 'COMPLETED'; c.endedAt = new Date();
      await m.save(c);
      const until = this.disputeWindowEndsAt(c);
      const teams = await m.find(Team, { where: { competitionId: id } });
      await this.notify(m, c, c.createdBy, 'tournament-completed', '',
        `You ended "${c.name}". Players can dispute the results until ${until.toUTCString()}.\nAfter that, a finance moderator reviews the results and releases the prizes and your registration revenue. Until then, all money stays in escrow.`);
      for (const name of new Set(teams.filter(activeTeam).flatMap(t => t.memberUsernames))) {
        await this.notify(m, c, name, 'tournament-completed', '',
          `Results for "${c.name}" are final.\n\nIf you believe a result is wrong, raise a dispute before ${until.toUTCString()}. Prize payouts are released by a finance moderator only after this window closes and every dispute is resolved.`);
      }
      await this.audit(m, c, user.username, 'SETTLEMENT_REQUESTED', 'Results completed; dispute window opened.');
      return c;
    });
  }

  async settle(id: string, user: any) {
    if (!financeRole(user)) throw new ForbiddenException('Finance moderator access required');
    return this.locked(id, async (m, c) => {
      if (c.paymentStatus === 'PRIZE_RELEASED') return { duplicate: true };
      await this.assertNeutral(m, c, user);
      if (c.paymentStatus !== 'COMPLETED' || c.financeHold) throw new BadRequestException('Completion and removal of finance holds are required.');
      const until = this.disputeWindowEndsAt(c);
      if (until && Date.now() < +until) throw new BadRequestException(`Players can dispute the results until ${until.toUTCString()}. Settle after the dispute window closes.`);
      const disputes = await m.find(Dispute, { where: { competitionId: id } });
      if (disputes.some(d => d.status !== DisputeStatus.RESOLVED)) throw new BadRequestException('Resolve all disputes before releasing funds.');
      const { groups, teams } = await this.rankGroups(m, c);
      const organizers = new Set([c.createdBy, ...(c.organizers || [])]);
      const teamById = new Map(teams.map(t => [t.id, t]));

      // Teams removed before settlement get their own fees back, never the organizer.
      for (const tx of await m.find(Transaction, { where: { competitionId: id, type: 'REGISTRATION', status: 'ESCROWED' } })) {
        const team = teamById.get(tx.teamId);
        if (!team || !activeTeam(team)) await this.refund(m, c, tx, 'Your team was removed before the competition was settled', 'registration-refunded');
      }

      const e = await this.escrow(m, c);
      const distribution = c.prizeDistributionMinor?.length ? c.prizeDistributionMinor : [e.prizeMinor];
      if (distribution.reduce((a, b) => a + b, 0) !== e.prizeMinor) throw new BadRequestException('Prize distribution must equal deposited funds.');
      const { allocations: awarded, unawarded } = allocatePrizes(distribution, groups);
      const allocations = new Map(awarded.map(a => [a.teamId, { amount: a.amount, label: a.label }]));

      // Each team prize is split equally between its members, so a captain cannot keep a shared prize.
      for (const [teamId, { amount, label }] of allocations) {
        const team = teamById.get(teamId);
        if (!team) throw new BadRequestException('Winning team missing');
        if (!activeTeam(team)) throw new BadRequestException(`Prize-winning team ${team.name} is ${team.status}. Resolve this through a dispute before settlement.`);
        const members = Array.from(new Set<string>(team.memberUsernames?.length ? team.memberUsernames : [team.leaderId])).sort();
        if (members.some(name => organizers.has(name))) throw new BadRequestException(`Prize-winning team ${team.name} includes an organizer of this competition. Place a hold and investigate.`);
        for (let i = 0; i < members.length; i++) {
          const share = Math.floor(amount / members.length) + (i < amount % members.length ? 1 : 0);
          await this.entry(m, c, 'PAYOUT', `${teamId}:${members[i]}`, members[i], share, 'OUT', teamId);
          await this.notify(m, c, members[i], 'winner-payout', teamId,
            `Congratulations! Team ${team.name} finished in prize position ${label}.\nTeam prize: ${inr(amount)}, split equally between ${members.length} player(s).\nYour share: ${inr(share)} (mock — no bank transfer occurs).`);
        }
      }

      const registrations = await m.find(Transaction, { where: { competitionId: id, type: 'REGISTRATION', status: 'ESCROWED' } });
      const revenue = registrations.reduce((sum, tx) => sum + tx.amountMinor, 0);
      await this.entry(m, c, 'REG_FEE_RELEASED', '', c.createdBy, revenue, 'OUT');
      for (const tx of registrations) { tx.status = 'RELEASED'; await m.save(tx); }
      const prize = await m.findOneBy(Transaction, { competitionId: id, type: 'PRIZE_POOL' });
      if (prize) { prize.status = 'RELEASED'; await m.save(prize); }
      // Prize places nobody could fill (e.g. 3 places, 2 teams) go back to the organizer.
      if (unawarded > 0) await this.entry(m, c, 'PRIZE_RETURN', 'unawarded', c.createdBy, unawarded, 'OUT');
      e.payoutsMinor += e.prizeMinor - unawarded + revenue; e.refundsMinor += unawarded;
      e.balanceMinor -= e.prizeMinor + revenue;
      if (e.balanceMinor !== 0) throw new BadRequestException('Ledger does not reconcile');
      e.status = 'RELEASED';
      await m.save(e);
      c.paymentStatus = 'PRIZE_RELEASED';
      await m.save(c);
      await this.notify(m, c, c.createdBy, 'organizer-revenue-released', '',
        `Registration revenue of ${inr(revenue)} from ${registrations.length} registration(s) has been released to you in full (mock).\nThe platform fee was collected separately at publication.${unawarded > 0 ? `\n\n${inr(unawarded)} of the prize pool was for places no team could fill, so it has been returned to you.` : ''}`);
      await this.audit(m, c, user.username, 'ESCROW_RELEASED', 'Reviewed results and released mock escrow.');
      return e;
    });
  }

  /**
   * Dispute override (§9.6): when fraud is proven after settlement, finance claws
   * back the released registration revenue from the organizer and refunds every
   * player in full. Prize payouts already made to winners are left untouched.
   */
  async reverse(id: string, user: any, reason: string) {
    if (!financeRole(user)) throw new ForbiddenException('Finance moderator access required');
    return this.locked(id, async (m, c) => {
      if (c.paymentStatus === 'REVERSED') return { duplicate: true };
      await this.assertNeutral(m, c, user);
      if (c.paymentStatus !== 'PRIZE_RELEASED') throw new BadRequestException('Only settled competitions can be reversed.');
      const registrations = await m.find(Transaction, { where: { competitionId: id, type: 'REGISTRATION', status: 'RELEASED' } });
      const total = registrations.reduce((sum, tx) => sum + tx.amountMinor, 0);
      if (total > 0) {
        const e = await this.escrow(m, c);
        await this.entry(m, c, 'CLAWBACK', '', c.createdBy, total, 'IN', undefined, 'CONFIRMED');
        e.balanceMinor += total; e.payoutsMinor -= total;
        await m.save(e); // persist before refunds read and update the escrow row
      }
      for (const tx of registrations) {
        tx.status = 'ESCROWED'; // funds are back in escrow, then refunded out
        await this.refund(m, c, tx, `Settlement reversed after a fraud review: ${reason}`);
      }
      const released = await m.findOneBy(Transaction, { competitionId: id, type: 'REG_FEE_RELEASED' });
      if (released) { released.status = 'REVERSED'; await m.save(released); }
      const e = await this.escrow(m, c);
      if (e.balanceMinor !== 0) throw new BadRequestException('Ledger does not reconcile');
      e.status = 'REVERSED';
      await m.save(e);
      c.paymentStatus = 'REVERSED'; c.abandonedReason = reason;
      await m.save(c);
      await this.penalize(m, c.createdBy, TRUST_PENALTY_FRAUD);
      await this.notify(m, c, c.createdBy, 'settlement-reversed-organizer', '',
        `Following a finance review, the settlement of "${c.name}" was reversed.\nReason: ${reason}.\n\n${inr(total)} of released registration revenue was recovered and refunded to players. Your organizer trust score was reduced by ${TRUST_PENALTY_FRAUD}.`);
      await this.audit(m, c, user.username, 'SETTLEMENT_REVERSED', reason);
      return e;
    });
  }

  async hold(id: string, user: any, held: boolean, reason: string) {
    if (!financeRole(user)) throw new ForbiddenException('Finance moderator access required');
    return this.locked(id, async (m, c) => {
      await this.assertNeutral(m, c, user);
      if (terminal(c)) throw new BadRequestException('Competition already settled or cancelled');
      c.financeHold = held;
      await m.save(c);
      await this.audit(m, c, user.username, held ? 'FINANCE_HOLD' : 'FINANCE_HOLD_REMOVED', reason);
      return c;
    });
  }

  async releaseHeldPrize(id: string, user: any, reason: string) {
    if (!financeRole(user)) throw new ForbiddenException('Finance moderator access required');
    return this.locked(id, async (m, c) => {
      const e = await this.escrow(m, c);
      if (e.status === 'REFUNDED' && e.balanceMinor === 0) return { duplicate: true };
      await this.assertNeutral(m, c, user);
      if (e.status !== 'HELD' || c.paymentStatus !== 'REFUND_ISSUED') throw new BadRequestException('No cancelled prize funds await review.');
      // Compensate players whose teams were still in the competition when it was cancelled.
      const teams = new Map((await m.find(Team, { where: { competitionId: id } })).map(t => [t.id, t]));
      const regs = await m.find(Transaction, { where: { competitionId: id, type: 'REGISTRATION' } });
      const payers = Array.from(new Set(regs.filter(t => teams.get(t.teamId) && activeTeam(teams.get(t.teamId))).map(t => t.userUsername))).sort();
      if (!payers.length) throw new BadRequestException('No affected players to compensate.');
      const total = e.balanceMinor;
      for (let i = 0; i < payers.length; i++) {
        const amount = Math.floor(total / payers.length) + (i < total % payers.length ? 1 : 0);
        await this.entry(m, c, 'PAYOUT', `cancelled:${payers[i]}`, payers[i], amount, 'OUT');
        await this.notify(m, c, payers[i], 'winner-payout', 'cancelled', `As compensation for the cancellation, finance awarded you ${inr(amount)} from the organizer's forfeited prize pool (mock).\nNote: ${reason}`);
      }
      e.payoutsMinor += total; e.balanceMinor = 0; e.status = 'REFUNDED';
      await m.save(e);
      await this.notify(m, c, c.createdBy, 'held-prize-distributed', '',
        `Finance reviewed the prize pool you deposited for the cancelled competition "${c.name}".\n${inr(total)} was distributed to ${payers.length} affected player(s) as compensation.\nNote: ${reason}`);
      await this.audit(m, c, user.username, 'HELD_PRIZE_DISTRIBUTED', reason);
      return e;
    });
  }

  /** Mock-only testing tool: closes the dispute window so settlement can be tested immediately. */
  /**
   * Finance review of an organizer's trust score (e.g. after cancellations that were
   * not the organizer's fault). Neutral finance only; the reason is audited and the
   * organizer is told the outcome.
   */
  async reviewTrust(id: string, user: any, score: number, reason: string) {
    if (!financeRole(user)) throw new ForbiddenException('Finance moderator access required');
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new BadRequestException('Trust score must be a whole number from 0 to 100.');
    return this.locked(id, async (m, c) => {
      await this.assertNeutral(m, c, user);
      const organizer = await m.findOneBy(User, { username: c.createdBy });
      if (!organizer) throw new NotFoundException('Organizer not found');
      const before = Number(organizer.organizerTrustScore ?? 100);
      if (before === score) return { username: organizer.username, organizerTrustScore: score };
      organizer.organizerTrustScore = score;
      await m.save(organizer);
      const minimum = Number(this.config.get('MIN_ORGANIZER_TRUST_SCORE', DEFAULT_MIN_ORGANIZER_TRUST));
      await this.audit(m, c, user.username, 'TRUST_SCORE_REVIEWED', `@${organizer.username}: ${before} → ${score}. ${reason}`);
      await this.notify(m, c, organizer.username, 'trust-score-reviewed', String(Date.now()),
        `A finance moderator reviewed your organizer trust score: ${before} → ${score}.\nReason: ${reason}\n\n${score >= minimum ? 'You can create competitions.' : `You need at least ${minimum} to create competitions.`}`);
      return { username: organizer.username, organizerTrustScore: score };
    });
  }

  async mockCloseDisputeWindow(id: string, user: any) {
    if (!financeRole(user)) throw new ForbiddenException('Finance moderator access required');
    return this.locked(id, async (m, c) => {
      if (c.paymentStatus !== 'COMPLETED' || !c.endedAt) throw new BadRequestException('The dispute window opens when the competition is ended.');
      const hours = Number(this.config.get('DISPUTE_WINDOW_HOURS', 24));
      c.endedAt = new Date(Date.now() - hours * 3600000 - 1000);
      await m.save(c);
      await this.audit(m, c, user.username, 'MOCK_DISPUTE_WINDOW_CLOSED', 'Testing tool: dispute window closed early.');
      return { disputeWindowEndsAt: this.disputeWindowEndsAt(c) };
    });
  }

  /**
   * Mock-only testing tool: moves the start date to now so the whole lifecycle
   * (end → settle, or the unfunded-prize auto-cancel) can be tested without waiting.
   */
  async mockStartNow(id: string, user: any) {
    return this.locked(id, async (m, c) => {
      if (!financeRole(user)) this.owner(c, user);
      if (!c.organizerPaid || terminal(c)) throw new BadRequestException('Only a published, active competition can be started.');
      const now = new Date();
      if (+new Date(c.startDate) <= +now) return { duplicate: true, startDate: c.startDate };
      c.startDate = now;
      if (c.registrationCloseAt && +new Date(c.registrationCloseAt) > +now) c.registrationCloseAt = now;
      await m.save(c);
      await this.audit(m, c, user.username, 'MOCK_START_NOW', 'Testing tool: start date moved to now.');
      return { startDate: now };
    });
  }

  /** Who would be paid what if the competition were settled now, or why it can't be yet. */
  private async payoutPreview(c: Competition) {
    try {
      const { groups, teams } = await this.rankGroups(this.db.manager, c);
      const e = await this.db.getRepository(Escrow).findOneBy({ competitionId: c.id });
      const prizeMinor = e?.prizeMinor ?? minor(c.prize);
      const distribution = c.prizeDistributionMinor?.length ? c.prizeDistributionMinor : [prizeMinor];
      const { allocations, unawarded } = allocatePrizes(distribution, groups);
      const names = new Map(teams.map(t => [t.id, t.name]));
      return { allocations: allocations.map(a => ({ ...a, teamName: names.get(a.teamId) || 'Team' })), unawarded };
    } catch (error) {
      return { error: error.message };
    }
  }

  async summary(id: string, user: any) {
    const c = await this.db.getRepository(Competition).findOneBy({ id });
    if (!c) throw new NotFoundException('Competition not found');
    const owner = c.createdBy === user.username || (c.organizers || []).includes(user.username);
    const finance = financeRole(user);
    const transactions = await this.db.getRepository(Transaction).find({ where: owner || finance ? { competitionId: id } : { competitionId: id, userUsername: user.username }, order: { createdAt: 'DESC' } });
    const registrations = owner || finance ? transactions.filter(t => t.type === 'REGISTRATION') : [];
    const organizer = await this.db.getRepository(User).findOne({ where: { username: c.createdBy }, select: { username: true, organizerTrustScore: true } });
    const openDisputes = finance ? await this.db.getRepository(Dispute).count({ where: { competitionId: id } }) - await this.db.getRepository(Dispute).count({ where: { competitionId: id, status: DisputeStatus.RESOLVED } }) : 0;
    const started = +new Date(c.startDate) <= Date.now();
    return {
      competition: c.name, competitionId: id, paymentStatus: c.paymentStatus, status: c.status,
      startDate: c.startDate, endDate: c.endDate, prizeDeadline: managed(c) ? this.deadline(c) : null, endedAt: c.endedAt, abandonedReason: c.abandonedReason,
      disputeWindowEndsAt: this.disputeWindowEndsAt(c), overdue: !terminal(c) && c.organizerPaid && c.paymentStatus !== 'COMPLETED' && +new Date(c.endDate) < Date.now(),
      platformFeePaid: c.organizerPaid, platformFeeAmount: c.platformFee || 0,
      prizePoolPaid: c.prizePoolPaid, prizePoolPaidAt: c.prizePoolPaidAt, prizePoolAmount: c.prize || 0,
      feeType: c.feeType, entryFeeAmount: c.entryFeeAmount || 0,
      financeHold: c.financeHold, owner, canModerate: finance,
      canEnd: c.organizerPaid && c.prizePoolPaid && started && !terminal(c) && c.paymentStatus !== 'COMPLETED',
      started, openDisputes, organizer: c.createdBy, organizerTrustScore: organizer?.organizerTrustScore ?? 100,
      totalRegistrations: registrations.length,
      payoutPreview: (owner || finance) && managed(c) && c.organizerPaid && started && ['OPEN_FOR_REGISTRATION', 'COMPLETED'].includes(c.paymentStatus) ? await this.payoutPreview(c) : null,
      prizeDistributionMinor: c.prizeDistributionMinor,
      escrow: await this.db.getRepository(Escrow).findOneBy({ competitionId: id }),
      transactions,
    };
  }

  async inbox(user: any) {
    return this.db.getRepository(Mail).find({ where: financeRole(user) ? {} : { username: user.username }, order: { createdAt: 'DESC' }, take: 100 });
  }

  /** The signed-in user's own payments, refunds and payouts across competitions. */
  async myPayments(user: any) {
    const items = await this.db.getRepository(Transaction).find({ where: { userUsername: user.username }, order: { createdAt: 'DESC' }, take: 200 });
    const ids = Array.from(new Set(items.map(t => t.competitionId)));
    const comps = ids.length ? await this.db.getRepository(Competition).find({ where: { id: In(ids) }, select: { id: true, name: true, paymentStatus: true } }) : [];
    const byId = new Map(comps.map(c => [c.id, c]));
    return items.map(t => ({ ...t, competitionName: byId.get(t.competitionId)?.name || 'Competition', competitionPaymentStatus: byId.get(t.competitionId)?.paymentStatus }));
  }

  /** Finance queue: every payment-managed competition with escrow, trust and dispute context. */
  async competitions() {
    const items = await this.db.getRepository(Competition).createQueryBuilder('c')
      .where('c.paymentStatus != :legacy', { legacy: 'LEGACY' })
      .select(['c.id', 'c.name', 'c.createdBy', 'c.paymentStatus', 'c.status', 'c.organizerPaid', 'c.prizePoolPaid', 'c.financeHold', 'c.startDate', 'c.endDate', 'c.prize', 'c.platformFee', 'c.feeType', 'c.entryFeeAmount', 'c.endedAt', 'c.abandonedReason', 'c.createdAt'])
      .orderBy('c.createdAt', 'DESC').take(200).getMany();
    const ids = items.map(c => c.id);
    const owners = Array.from(new Set(items.map(c => c.createdBy)));
    const [escrows, users, disputes] = ids.length ? await Promise.all([
      this.db.getRepository(Escrow).find({ where: { competitionId: In(ids) } }),
      this.db.getRepository(User).find({ where: { username: In(owners) }, select: { username: true, organizerTrustScore: true } }),
      this.db.getRepository(Dispute).find({ where: { competitionId: In(ids) }, select: { competitionId: true, status: true } }),
    ]) : [[], [], []];
    const escrowBy = new Map(escrows.map(e => [e.competitionId, e]));
    const trustBy = new Map(users.map(u => [u.username, u.organizerTrustScore]));
    return items.map(c => ({
      ...c,
      prizeDeadline: this.deadline(c),
      disputeWindowEndsAt: this.disputeWindowEndsAt(c),
      overdue: !terminal(c) && c.organizerPaid && c.paymentStatus !== 'COMPLETED' && +new Date(c.endDate) < Date.now(),
      escrow: escrowBy.get(c.id) || null,
      organizerTrustScore: trustBy.get(c.createdBy) ?? 100,
      openDisputes: disputes.filter(d => d.competitionId === c.id && d.status !== DisputeStatus.RESOLVED).length,
    }));
  }

  async subscribe(user: any, enabled: boolean) {
    await this.db.getRepository(User).update({ username: user.username }, { competitionAlerts: enabled });
    return { enabled };
  }
  async subscription(user: any) {
    const u = await this.db.getRepository(User).findOne({ where: { username: user.username }, select: { username: true, competitionAlerts: true } });
    return { enabled: !!u?.competitionAlerts };
  }

  /** Testing tool: run the deadline job immediately (mock mode only). */
  async runDeadlinesNow() {
    this.mock();
    await this.runDeadlines();
  }

  async runDeadlines() {
    if (this.running || this.config.get('PAYMENT_PROVIDER', 'mock') !== 'mock' || this.config.get('NODE_ENV') === 'production') return;
    this.running = true;
    try {
      const items = await this.db.getRepository(Competition).createQueryBuilder('c')
        .where('c.paymentStatus NOT IN (:...states)', { states: ['LEGACY', ...TERMINAL_PAYMENT_STATES] }).getMany();
      for (const item of items) {
        await this.locked(item.id, async (m, c) => {
          if (terminal(c)) return;
          const now = Date.now();
          const expiry = Number(this.config.get('DRAFT_EXPIRY_HOURS', 24)) * 3600000;
          if (c.paymentStatus === 'AWAITING_PLATFORM_FEE' && now - +new Date(c.createdAt) > expiry) {
            const pending = await m.find(Transaction, { where: { competitionId: c.id } });
            if (pending.some(t => t.gatewayOrderId && !t.gatewayOrderId.startsWith('mock_'))) return;
            c.paymentStatus = 'EXPIRED'; c.status = 'cancelled';
            await m.save(c);
            return;
          }
          if (!c.organizerPaid || c.prizePoolPaid) return;
          const deadline = this.deadline(c);
          const teams = (await m.find(Team, { where: { competitionId: c.id } })).filter(activeTeam).length;
          for (const hours of [48, 24]) {
            if (+deadline - now <= hours * 3600000) {
              await this.notify(m, c, c.createdBy, hours === 48 ? 'prize-pool-reminder' : 'prize-pool-urgent', String(hours),
                `"${c.name}" has ${teams} registered team(s), but the prize pool (${inr(minor(c.prize))}) has not been deposited.\nDeadline: ${deadline.toUTCString()}\n\nIf it is not paid by the deadline:\n• the competition will be cancelled automatically\n• every team receives a full refund\n• your platform fee of ₹${Number(c.platformFee || 0).toLocaleString('en-IN')} is forfeited\n• your organizer trust score drops`);
            }
          }
        });
        const c = await this.db.getRepository(Competition).findOneBy({ id: item.id });
        if (c.organizerPaid && !c.prizePoolPaid && !terminal(c) && +this.deadline(c) <= Date.now()) {
          await this.cancel(c.id, { username: 'system' }, 'Prize pool was not funded before the deadline');
        }
      }
    } finally { this.running = false; }
  }
}
