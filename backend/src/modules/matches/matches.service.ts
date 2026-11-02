import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { buildBracket } from '../../common/tournament/bracket';
import { MatchEntity } from '../../entities/match.entity';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { TeamRepository } from '../teams/repositories/team.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import {
  roundRobinFixtures,
  eliminationPairings,
  computeStandings,
  iplPlayoffFixtures,
  scheduleFixtures,
  findScheduleConflicts,
} from '../../common/tournament/tournament.utils';

const DEFAULT_MATCH_DURATION_MINUTES = 60;   // §8.2 — configurable via env MATCH_DURATION_MINUTES
const DEFAULT_INTERVAL_MINUTES = 30;         // configurable via env MATCH_INTERVAL_MINUTES

@Injectable()
export class MatchesService {
  private locked = false;

  // Serialize fixture writes across API processes and commit each change atomically.
  private async lockedWrite<T>(competitionId: string, work: (service: MatchesService) => Promise<T>): Promise<T> {
    if (this.locked || !this.repo.manager) return work(this);
    return this.repo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [competitionId]);
      const service = new MatchesService(manager.getRepository(MatchEntity), this.competitionRepository, this.teamRepository, this.notificationsService, this.auditLog);
      service.locked = true;
      return work(service);
    });
  }

  async assertOrganizer(competitionId: string, actor: string, role = '') {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) throw new NotFoundException('Competition not found');
    const username = String(actor || '').toLowerCase();
    const organizer = [competition.createdBy, ...(competition.organizers || [])].some((name) => String(name || '').toLowerCase() === username);
    if (!organizer && !['admin', 'super_admin', 'comp_admin'].includes(role)) {
      throw new ForbiddenException('Only an organizer of this competition (or a competition admin) can edit fixtures.');
    }
    if (competition.status === 'completed') throw new BadRequestException('This competition has already ended.');
    return competition;
  }

  async assertRosterCanChange(competitionId: string): Promise<void> {
    const matches = await this.findByCompetition(competitionId);
    if (matches.some((match) => ['completed', 'ongoing', 'live'].includes(match.status))) {
      throw new BadRequestException('Team registration is locked because this bracket has already started.');
    }
  }

  async syncRosterAfterRegistration(competitionId: string): Promise<{ rebuilt: boolean; created: number }> {
    if (!this.locked && this.repo.manager) return this.lockedWrite(competitionId, (service) => service.syncRosterAfterRegistration(competitionId));
    const existing = await this.findByCompetition(competitionId);
    if (!existing.length) return { rebuilt: false, created: 0 };
    await this.assertRosterCanChange(competitionId);
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition || this.resolveFormat(competition) !== 'elimination' || /double/i.test(competition.format || '')) return { rebuilt: false, created: 0 };
    const eligible = (await this.teamRepository.findByCompetition(competitionId)).filter((team) => !['rejected', 'banned', 'disbanded'].includes(team.status));
    const eligibleIds = new Set(eligible.map((team) => team.id));
    const persisted = existing.filter((match) => match.bracket?.version === 2 && match.bracket.round === 1)
      .flatMap((match) => match.bracket.slots || []).filter((slot) => slot.teamId && eligibleIds.has(slot.teamId))
      .sort((a, b) => a.seed - b.seed).map((slot) => slot.teamId);
    const seedOrder = [...new Set([...persisted, ...eligible.map((team) => team.id)])];
    await this.repo.delete({ competitionId });
    const result = await this.completeBracket(competitionId, 'system:team-registration', 'admin', seedOrder);
    return { rebuilt: true, created: result.created };
  }

  /** Persist the complete seeded topology, including bye positions and winner destinations. */
  async completeBracket(competitionId: string, actor: string, role = '', seedOrder?: string[]): Promise<{ created: number; skipped: number; protectedCompleted: number }> {
    if (!this.locked && this.repo.manager) return this.lockedWrite(competitionId, (service) => service.completeBracket(competitionId, actor, role, seedOrder));
    const competition = await this.assertOrganizer(competitionId, actor, role);
    if (this.resolveFormat(competition) !== 'elimination' || /double/i.test(competition.format || '')) throw new BadRequestException('Full bracket completion is available for single elimination.');
    const teams = (await this.teamRepository.findByCompetition(competitionId)).filter((t) => !['rejected', 'banned', 'disbanded'].includes(t.status));
    if (teams.length < 2) throw new BadRequestException('At least 2 eligible registered teams are required.');
    const existing = await this.findByCompetition(competitionId);
    const persistedSeeds = existing.filter((m) => m.bracket?.version === 2 && m.bracket.round === 1)
      .flatMap((m) => m.bracket.slots).filter((slot) => slot.teamId).sort((a, b) => a.seed - b.seed).map((slot) => slot.teamId);
    const registered = new Set(teams.map((t) => t.id));
    const sameRoster = persistedSeeds.length === teams.length && persistedSeeds.every((id) => registered.has(id));
    const ordered = seedOrder || (sameRoster ? persistedSeeds : teams.map((t) => t.id));
    if (!Array.isArray(ordered) || ordered.length !== teams.length || new Set(ordered).size !== teams.length || ordered.some((id) => !registered.has(id))) throw new BadRequestException('Seed order must list every eligible registered team exactly once, strongest first.');
    const plan = buildBracket(ordered);
    if (existing.length === plan.length && existing.every((m) => m.bracket?.version === 2) && sameRoster && ordered.every((id, i) => id === persistedSeeds[i])) {
      return { created: 0, skipped: existing.filter((m) => m.status !== 'bye' && !m.scheduledAt).length, protectedCompleted: existing.filter((m) => m.status === 'completed').length };
    }
    if (existing.some((m) => ['completed', 'ongoing', 'live'].includes(m.status))) throw new BadRequestException('A started bracket cannot be reseeded or rebuilt. Existing results have been preserved.');
    const names = new Map(teams.map((t) => [t.id, t.name]));
    const used = new Set<string>();
    const adopted = new Map<string, MatchEntity>();
    // Keep IDs and dates where possible, but never reuse a played position as a bye.
    for (const node of plan) {
      const [a, b] = node.sides;
      const isBye = a.bye || b.bye;
      const old = existing.find((m) => !used.has(m.id) && m.bracket?.version === 2 && m.bracket.key === node.key && (m.status === 'bye') === !!isBye)
        || (!isBye && existing.find((m) => !used.has(m.id) && a.teamId && b.teamId && ((m.team1Id === a.teamId && m.team2Id === b.teamId) || (m.team1Id === b.teamId && m.team2Id === a.teamId))))
        || (!isBye && existing.find((m) => !used.has(m.id) && m.round === node.round && m.bracket?.key === node.key));
      if (old) { used.add(old.id); adopted.set(node.key, old); }
    }
    if (existing.some((m) => !used.has(m.id))) throw new BadRequestException('Existing fixtures do not match the registered teams and bracket seeds. No fixtures were changed.');
    const ids = new Map(plan.map((node) => [node.key, adopted.get(node.key)?.id || randomUUID()]));
    const built = new Map<string, MatchEntity>();
    const writes: MatchEntity[] = [];
    const duration = this.matchDurationMinutes();
    let cursor = +new Date(competition.startDate);
    const end = +new Date(competition.endDate);
    for (const node of plan) {
      const old = adopted.get(node.key);
      const slots = node.sides.map((side) => {
        const source = side.source ? built.get(side.source) : null;
        const winningSlot = source?.bracket.slots.find((slot) => slot.teamId && slot.teamId === source.winnerId);
        return { teamId: side.teamId || source?.winnerId || null, seed: side.seed || winningSlot?.seed || null, ...(side.source ? { sourceMatchId: ids.get(side.source) } : {}), ...(side.bye ? { bye: true } : {}) };
      }) as MatchEntity['bracket']['slots'];
      const isBye = slots.some((slot) => slot.bye);
      const winner = isBye ? slots.find((slot) => slot.teamId) : null;
      const label = (index: number) => slots[index].teamId ? names.get(slots[index].teamId) : slots[index].bye ? 'Bye' : `Winner of ${built.get(node.sides[index].source).round} ${built.get(node.sides[index].source).bracket.position}`;
      const match = this.repo.create({
        ...old, id: ids.get(node.key), competitionId,
        team1Id: slots[0].teamId, team2Id: slots[1].teamId, team1Name: label(0), team2Name: label(1),
        winnerId: winner?.teamId || null, winnerName: winner ? names.get(winner.teamId) : null, score: null,
        status: isBye ? 'bye' : slots.every((slot) => slot.teamId) ? 'ready' : 'pending',
        round: node.round, createdBy: old?.createdBy || actor, durationMinutes: old?.durationMinutes || duration,
        resultRule: 'standard', resultDetails: null,
        bracket: { version: 2, key: node.key, round: node.roundIndex, position: node.position, bracketSize: node.bracketSize, roundCount: node.roundCount, slots,
          nextMatchId: node.destination ? ids.get(node.destination.key) : null, nextSlot: node.destination?.slot || null,
          source1: slots[0].sourceMatchId, source2: slots[1].sourceMatchId },
      });
      if (isBye) match.scheduledAt = null;
      else if (!old?.scheduledAt) {
        const occupied = [...existing, ...writes].filter((m) => m.scheduledAt && m.status !== 'bye').sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
        for (const other of occupied) {
          const start = +new Date(other.scheduledAt), finish = start + (other.durationMinutes || duration) * 60_000;
          if (cursor < finish && cursor + duration * 60_000 > start) cursor = finish + this.intervalMinutes() * 60_000;
        }
        match.scheduledAt = Number.isFinite(cursor) && cursor + duration * 60_000 <= end ? new Date(cursor) : null;
      }
      if (match.scheduledAt) cursor = Math.max(cursor, +new Date(match.scheduledAt) + (match.durationMinutes + this.intervalMinutes()) * 60_000);
      built.set(node.key, match); writes.push(match);
    }
    for (const match of writes) await this.repo.save(match);
    const created = writes.length - existing.length;
    await this.auditLog.record('BRACKET_GENERATED', { actor, entityType: 'competition', entityId: competitionId, details: `Seeded ${teams.length} teams into ${plan[0].bracketSize} slots; ${writes.filter((m) => m.status === 'bye').length} automatic byes.`, metadata: { seeds: ordered } });
    return { created, skipped: writes.filter((m) => m.status !== 'bye' && !m.scheduledAt).length, protectedCompleted: 0 };
  }

  constructor(
    @InjectRepository(MatchEntity)
    private readonly repo: Repository<MatchEntity>,
    private readonly competitionRepository: CompetitionRepository,
    private readonly teamRepository: TeamRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private matchDurationMinutes(): number {
    const v = parseInt(process.env.MATCH_DURATION_MINUTES || '', 10);
    return v > 0 ? v : DEFAULT_MATCH_DURATION_MINUTES;
  }

  private intervalMinutes(): number {
    const v = parseInt(process.env.MATCH_INTERVAL_MINUTES || '', 10);
    return v > 0 ? v : DEFAULT_INTERVAL_MINUTES;
  }

  async create(data: {
    competitionId: string;
    team1Id?: string;
    team2Id?: string;
    team1Name?: string;
    team2Name?: string;
    scheduledAt?: Date;
    round?: string;
    notes?: string;
    createdBy?: string;
  }, actor?: string): Promise<MatchEntity> {
    if (!data.competitionId) throw new BadRequestException('competitionId is required.');
    if (!this.locked && this.repo.manager) return this.lockedWrite(data.competitionId, (service) => service.create(data, actor));

    // §11 — validate manual scheduling against competition window + conflicts
    if (data.scheduledAt) {
      const comp = await this.competitionRepository.findById(data.competitionId);
      if (!comp) throw new NotFoundException('Competition not found');
      const existing = await this.repo.find({ where: { competitionId: data.competitionId } });
      const conflicts = findScheduleConflicts(
        { ...data, scheduledAt: data.scheduledAt },
        existing as any,
        { start: new Date(comp.startDate), end: new Date(comp.endDate) },
        this.matchDurationMinutes(),
      );
      if (conflicts.length) throw new BadRequestException(conflicts.join(' '));
    }

    const match = this.repo.create({ ...data, durationMinutes: this.matchDurationMinutes(), status: 'scheduled' });
    const saved = await this.repo.save(match);
    await this.auditLog.record('MATCH_SCHEDULED', {
      actor: actor || data.createdBy || 'system',
      entityType: 'match',
      entityId: (saved as any).id,
      details: `Match ${data.team1Name || data.team1Id || ''} vs ${data.team2Name || data.team2Id || ''} scheduled.`,
      metadata: { competitionId: data.competitionId, scheduledAt: data.scheduledAt || null },
    });
    // §14 — notify participant team leads of scheduling
    this.notifyTeams(saved, '📅 Match Scheduled');
    return saved;
  }

  private async notifyTeams(match: MatchEntity, title: string, body?: string) {
    const targets = new Set<string>();
    for (const teamId of [match.team1Id, match.team2Id]) {
      if (!teamId) continue;
      const team = await this.teamRepository.findById(teamId).catch(() => null);
      if (team) {
        if (team.leaderId) targets.add(String(team.leaderId));
        (team.memberUsernames || []).forEach((m) => targets.add(m));
      }
    }
    targets.forEach((t) => {
      this.notificationsService.create({
        toUsername: t,
        type: 'match-scheduled',
        title,
        body: body || `Match ${match.team1Name || ''} vs ${match.team2Name || ''} on ${match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : 'TBD'} (${match.round || '-'}).`,
        meta: { compId: match.competitionId, matchId: (match as any).id },
      }).catch(() => {});
    });
  }

  async findByCompetition(competitionId: string): Promise<MatchEntity[]> {
    return this.repo.find({ where: { competitionId }, order: { scheduledAt: 'ASC' } });
  }

  async findById(id: string): Promise<MatchEntity> {
    const match = await this.repo.findOne({ where: { id } });
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }

  /**
   * §11 — organizer schedule edits. Completed/verified matches cannot be moved;
   * conflicts against the window and team overlaps are rejected with clear errors.
   */
  async updateSchedule(id: string, updates: { scheduledAt?: Date; round?: string; notes?: string }, actor: string): Promise<MatchEntity> {
    const match = await this.findById(id);
    if (!this.locked && this.repo.manager) return this.lockedWrite(match.competitionId, (service) => service.updateSchedule(id, updates, actor));
    if (match.status === 'bye' || match.status === 'completed' || match.status === 'ongoing' || (match as any).winnerId) {
      throw new ForbiddenException('Verified/completed results cannot be modified through scheduling.');
    }
    if (updates.scheduledAt) {
      updates = { ...updates, scheduledAt: new Date(updates.scheduledAt) };
      const comp = await this.competitionRepository.findById(match.competitionId);
      if (!comp) throw new NotFoundException('Competition not found');
      const existing = await this.repo.find({ where: { competitionId: match.competitionId } });
      const conflicts = findScheduleConflicts(
        { team1Id: match.team1Id, team2Id: match.team2Id, scheduledAt: updates.scheduledAt, matchId: id, competitionId: match.competitionId },
        existing as any,
        { start: new Date(comp.startDate), end: new Date(comp.endDate) },
        match.durationMinutes || this.matchDurationMinutes(),
      );
      const at = +updates.scheduledAt;
      for (const other of existing) {
        if (!other.scheduledAt) continue;
        if ([match.bracket?.source1, match.bracket?.source2].includes(other.id) && at < +new Date(other.scheduledAt) + (other.durationMinutes || this.matchDurationMinutes()) * 60_000) conflicts.push('This match must start after its feeder matches finish.');
        if ([other.bracket?.source1, other.bracket?.source2].includes(id) && at + (match.durationMinutes || this.matchDurationMinutes()) * 60_000 > +new Date(other.scheduledAt)) conflicts.push('This match must finish before the next bracket match starts.');
      }
      if (conflicts.length) throw new BadRequestException(conflicts.join(' '));
    }
    const safe: Partial<MatchEntity> = {};
    if (updates.scheduledAt) safe.scheduledAt = updates.scheduledAt;
    if (updates.round) safe.round = updates.round;
    if (match.bracket && updates.round && updates.round !== match.round) throw new BadRequestException('A bracket match cannot be moved to another round.');
    if (updates.notes !== undefined) (safe as any).notes = updates.notes;

    await this.repo.update(id, safe);
    await this.auditLog.record('MATCH_RESCHEDULED', {
      actor,
      entityType: 'match',
      entityId: id,
      details: `Rescheduled${updates.scheduledAt ? ` to ${updates.scheduledAt.toISOString()}` : ''}.`,
      metadata: { competitionId: match.competitionId },
    });
    const updated = await this.findById(id);
    if (updates.scheduledAt) this.notifyTeams(updated, '🔁 Match Rescheduled');
    return updated;
  }

  /**
   * §8.3 — regeneration safety. Completed/verified matches are never touched;
   * existing scheduled fixtures are only replaced when `confirmOverlap` is set.
   */
  async generateSchedule(
    competitionId: string,
    actor: string,
    options: { confirmOverlap?: boolean; matchDurationMinutes?: number; intervalMinutes?: number; dailyWindow?: boolean; seedOrder?: string[] } = {},
    actorRole = '',
  ): Promise<{ created: number; skipped: number; protectedCompleted: number; requiresConfirmation?: boolean }> {
    if (!this.locked && this.repo.manager) return this.lockedWrite(competitionId, (service) => service.generateSchedule(competitionId, actor, options, actorRole));
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) throw new NotFoundException(`Competition ${competitionId} not found`);

    const normalizedActor = String(actor || '').toLowerCase();
    const isOrganizer = String(competition.createdBy || '').toLowerCase() === normalizedActor
      || (competition.organizers || []).some((name) => String(name).toLowerCase() === normalizedActor);
    const isAdmin = ['admin', 'super_admin', 'comp_admin'].includes(String(actorRole || '').toLowerCase());
    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException('Only an organizer of this competition (or a competition admin) can generate fixtures.');
    }

    const teams = await this.teamRepository.findByCompetition(competitionId);
    const eligible = teams.filter((t) => t.status !== 'rejected' && t.status !== 'banned' && t.status !== 'disbanded');
    const teamIds = eligible.map((t) => t.id);

    if (teamIds.length < 2) {
      throw new BadRequestException('At least 2 eligible registered teams are required to generate a schedule.');
    }

    const existing = await this.repo.find({ where: { competitionId } });
    const completed = existing.filter((m) => m.status === 'completed');
    const scheduled = existing.filter((m) => m.status !== 'completed');

    // Detect whether regenerating would change existing scheduled fixtures
    const format = this.resolveFormat(competition);
    if (format === 'elimination' && !/double/i.test(competition.format || '')) return this.completeBracket(competitionId, actor, actorRole, options.seedOrder);
    let planned: { team1Id: string; team2Id: string; roundLabel?: string }[] = [];
    if (format === 'round_robin' || format === 'league') {
      planned = roundRobinFixtures(teamIds).map((f) => ({ team1Id: f.team1Id, team2Id: f.team2Id, roundLabel: f.roundLabel }));
    } else {
      const bracket = eliminationPairings(teamIds, { doubleElimination: /double/i.test(String(competition.format || '')) });
      planned = bracket.firstRound.map((f) => ({ team1Id: f.team1Id, team2Id: f.team2Id, roundLabel: f.roundLabel }));
    }

    const teamNameById = new Map(eligible.map((t) => [t.id, t.name]));

    // Fixtures already covered by completed/scheduled matches will not be duplicated
    const covered = new Set<string>();
    const key = (t1, t2, label) => [t1, t2, label || ''].join('|');
    existing.forEach((m) => {
      const n1 = m.team1Name || teamNameById.get(m.team1Id) || '';
      const n2 = m.team2Name || teamNameById.get(m.team2Id) || '';
      covered.add(key(n1, n2, m.round));
      covered.add(key(n2, n1, m.round));
      covered.add(key(n1, n2, ''));
      covered.add(key(n2, n1, ''));
    });

    const missing = planned.filter((p) => {
      const t1n = teamNameById.get(p.team1Id); const t2n = teamNameById.get(p.team2Id);
      return !covered.has(key(t1n, t2n, p.roundLabel)) && !covered.has(key(t1n, t2n, ''));
    });

    const pendingChanges = scheduled.length > 0 || missing.length !== 0;
    if (pendingChanges && options.confirmOverlap !== true && scheduled.length > 0) {
      throw new BadRequestException(
        `Regenerating will affect ${scheduled.length} existing scheduled match(es). Re-request with confirmOverlap=true if you are sure. Completed results are never overwritten.`,
      );
    }

    // §8.3 — protecting verified results: completed matches are immutable by design
    let protectedCompleted = 0;

    if (options.confirmOverlap === true) {
      // Only delete scheduled (not completed) fixtures when explicitly confirmed
      for (const m of scheduled) {
        if (!(m as any).winnerId) {
          await this.repo.delete((m as any).id);
          protectedCompleted += 0;
        } else {
          protectedCompleted += 1;
        }
      }
      covered.clear();
      existing.filter((m) => m.status === 'completed').forEach((m) => {
        const n1 = m.team1Name || teamNameById.get(m.team1Id) || '';
        const n2 = m.team2Name || teamNameById.get(m.team2Id) || '';
        covered.add(key(n1, n2, m.round));
        covered.add(key(n2, n1, m.round));
        covered.add(key(n1, n2, ''));
        covered.add(key(n2, n1, ''));
      });
    }

    // §8.2 — schedule using organizer-configurable interval/duration + competition window
    const duration = options.matchDurationMinutes && options.matchDurationMinutes > 0 ? options.matchDurationMinutes : this.matchDurationMinutes();
    const interval = options.intervalMinutes && options.intervalMinutes > 0 ? options.intervalMinutes : this.intervalMinutes();
    const start = new Date(competition.startDate);
    const end = new Date(competition.endDate);
    const totalWindowMs = Math.max(end.getTime() - start.getTime(), interval * 60_000);
    const slotMs = (duration + interval) * 60_000;
    const totalSlots = Math.max(1, Math.ceil(totalWindowMs / slotMs));

    // seed slot index from completed matches so rescheduling stays consistent
    let created = 0;
    let skipped = 0;

    const plannable = planned
      .filter((p) => p.team1Id && p.team2Id)
      .map((p) => ({ team1Id: p.team1Id, team2Id: p.team2Id, roundLabel: p.roundLabel }))
      .filter((p) => {
        const team1Name = teamNameById.get(p.team1Id as string);
        const team2Name = teamNameById.get(p.team2Id as string);
        return !covered.has(key(team1Name, team2Name, p.roundLabel as string))
          && !covered.has(key(team1Name, team2Name, ''));
      });

    if (!plannable.length) return { created: 0, skipped: 0, protectedCompleted };

    const slots = scheduleFixtures(
      plannable.map((p, i) => ({ ...p, round: i + 1 })),
      (slotIndex) => new Date(start.getTime() + slotIndex * slotMs),
    );

    for (const s of slots) {
      if (s.slotIndex >= totalSlots) {
        skipped += 1;
        continue; // would overflow the competition window — skipped, never silently outside window
      }
      const team1 = await this.teamRepository.findById(s.fixture.team1Id);
      const team2 = await this.teamRepository.findById(s.fixture.team2Id);
      const createdMatch = this.repo.create({
        competitionId,
        team1Id: s.fixture.team1Id,
        team2Id: s.fixture.team2Id,
        team1Name: team1?.name || teamNameById.get(s.fixture.team1Id) || '',
        team2Name: team2?.name || teamNameById.get(s.fixture.team2Id) || '',
        status: 'scheduled',
        scheduledAt: s.scheduledAt,
        durationMinutes: duration,
        round: s.fixture.roundLabel,
        createdBy: actor,
      });
      await this.repo.save(createdMatch);
      created += 1;
      this.notifyTeams(createdMatch as any, '📅 Match Scheduled');
    }

    await this.auditLog.record('SCHEDULE_GENERATED', {
      actor,
      entityType: 'competition',
      entityId: competitionId,
      details: `Fixture generation (${format}): created=${created}, skipped=${skipped}, completed protected always.`,
      metadata: { format },
    });

    return { created, skipped, protectedCompleted };
  }

  private resolveFormat(competition: any): 'round_robin' | 'league' | 'elimination' {
    const fmt = String(competition.format || competition.type || '').toLowerCase();
    if (compLeague(competition)) return 'league';
    if (fmt.includes('robin')) return 'round_robin';
    return 'elimination';
  }

  /**
   * §10 — records a verified result and applies progression:
   * - updates match outcome (duplicate submissions are rejected)
   * - elimination: advances the verified winner to the next bracket match
   * - league→playoffs: when the league completes, builds IPL-style playoffs
   * - declares the tournament winner on the final match result
   * Disputed/unverified results (blocked upstream) can never advance teams.
   */
  async recordResult(id: string, winnerId: string, winnerName: string, score: string, actor: string): Promise<MatchEntity> {
    const match = await this.findById(id);
    if (!this.locked && this.repo.manager) return this.lockedWrite(match.competitionId, (service) => service.recordResult(id, winnerId, winnerName, score, actor));
    if (match.status === 'completed' || (match as any).winnerId) {
      throw new BadRequestException('A verified result already exists for this match. Duplicate submissions are rejected.');
    }
    if (!match.team1Id || !match.team2Id) throw new BadRequestException('Both participating teams must be decided before entering a result.');
    if (!score || !String(score).trim()) throw new BadRequestException('A score is required to record a result.');
    const scores = /^(\d+)\s*[-:]\s*(\d+)$/.exec(String(score).trim());
    if (!scores || !scores.slice(1).every((value) => Number.isSafeInteger(Number(value)))) throw new BadRequestException('Scores must be non-negative whole numbers, for example 2-1.');

    // §10 — draws are valid in league formats; knockout matches must have a winner.
    const competition = await this.competitionRepository.findById(match.competitionId);
    const isLeague = competition ? this.resolveFormat(competition) !== 'elimination' : false;
    const noWinner = !String(winnerId || '').trim() && !String(winnerName || '').trim();
    if (noWinner && !isLeague) {
      throw new BadRequestException('Knockout matches require a winner; draws are only valid in league formats.');
    }

    let resolvedName: string | null = null;
    if (!noWinner) {
      if (!winnerName) throw new BadRequestException('Winner is required.');
      // winner must be one of the two teams of the match
      const candidates = [match.team1Id, match.team2Id, match.team1Name, match.team2Name].filter(Boolean).map(String);
      if (!candidates.includes(String(winnerId)) && !candidates.includes(String(winnerName))) {
        throw new BadRequestException('Only a participating team of this match can be declared the winner.');
      }
      if (winnerId !== match.team1Id && winnerId !== match.team2Id) throw new BadRequestException('Only a participating team of this match can be declared the winner.');
      resolvedName = winnerId === match.team1Id ? match.team1Name : match.team2Name;
    }
    const side = Number(scores[1]) > Number(scores[2]) ? 1 : Number(scores[2]) > Number(scores[1]) ? 2 : 0;
    if ((!side && !noWinner && isLeague) || (side && (winnerId !== match[`team${side}Id`] || winnerName !== match[`team${side}Name`]))) throw new BadRequestException('Winner must match the submitted scores and participating team.');
    if (!isLeague && match.bracket?.version !== 2) throw new BadRequestException('Generate the full seeded bracket before recording knockout results.');

    await this.repo.update(id, {
      winnerId: noWinner ? null : winnerId,
      winnerName: noWinner ? null : resolvedName,
      score,
      resultRule: 'standard',
      resultDetails: !side && !noWinner ? { rule: 'standard', hostWinnerId: winnerId } : null,
      status: 'completed',
    });
    const updated = await this.findById(id);

    await this.auditLog.record('MATCH_RESULT_RECORDED', {
      actor,
      entityType: 'match',
      entityId: id,
      details: noWinner
        ? `Result verified: ${updated.team1Name} vs ${updated.team2Name} — draw (${score}).`
        : `Result verified: ${updated.team1Name} vs ${updated.team2Name} — winner ${resolvedName} (${score}).`,
      metadata: { competitionId: updated.competitionId },
    });

    await this.applyProgression(updated, actor);

    // §14 — result confirmation notification
    await this.notifyTeams(
      updated,
      '✅ Match Result',
      noWinner
        ? `Result confirmed: ${updated.team1Name} vs ${updated.team2Name} — draw (${score}).`
        : `Result confirmed: ${updated.team1Name} vs ${updated.team2Name} — winner ${resolvedName} (${score}).`,
    );
    return updated;
  }

  /** §9/§10 — verified-result progression (single place, transaction-consistent by sequential writes). */
  private async applyProgression(match: MatchEntity, actor: string): Promise<void> {
    const competition = await this.competitionRepository.findById(match.competitionId);
    if (!competition) return;
    const league = this.resolveFormat(competition) !== 'elimination';

    const finishTournament = async (winnerName: string | null) => {
      if (!winnerName) return;
      await this.competitionRepository.update(match.competitionId, { status: 'completed' } as any).catch(() => {});
      await this.auditLog.record('TOURNAMENT_WINNER', {
        actor,
        entityType: 'competition',
        entityId: match.competitionId,
        details: `"${competition.name}" completed. Winner: ${winnerName}.`,
      });
      const teams = await this.teamRepository.findByCompetition(match.competitionId);
      const winnerTeam = teams.find((t) => t.name.toLowerCase() === winnerName.toLowerCase());
      if (winnerTeam) {
        [...(winnerTeam.memberUsernames || []), winnerTeam.leaderId].filter(Boolean).forEach((u) =>
          this.notificationsService.create({
            toUsername: String(u),
            type: 'tournament-winner',
            status: 'approved',
            title: `🏆 Champion: ${winnerTeam.name}`,
            body: `Congratulations! Your team won "${competition.name}".`,
            meta: { compId: competition.id },
          }).catch(() => {}),
        );
      }
    };

    if (!league) {
      const destination = match.bracket?.nextMatchId;
      if (!destination) {
        if (match.bracket?.version !== 2 || match.bracket.round !== match.bracket.roundCount) throw new BadRequestException('The bracket has no valid winner destination.');
        await finishTournament(match.winnerName);
        return;
      }
      const next = await this.findById(destination);
      const side = match.bracket.nextSlot;
      if (![1, 2].includes(side) || next.competitionId !== match.competitionId || next.bracket?.slots?.[side - 1]?.sourceMatchId !== match.id) throw new BadRequestException('The stored winner destination is invalid.');
      if (next.status === 'completed') throw new BadRequestException('The destination match is already completed.');
      const winningSlot = match.bracket.slots.find((slot) => slot.teamId === match.winnerId);
      const slots = next.bracket.slots.map((slot, index) => index === side - 1 ? { ...slot, teamId: match.winnerId, seed: winningSlot.seed } : { ...slot }) as MatchEntity['bracket']['slots'];
      await this.repo.update(next.id, {
        [`team${side}Id`]: match.winnerId, [`team${side}Name`]: match.winnerName,
        bracket: { ...next.bracket, slots }, status: slots.every((slot) => slot.teamId) ? 'ready' : 'pending',
      });
      await this.auditLog.record('BRACKET_ADVANCED', { actor, entityType: 'match', entityId: next.id, details: `${match.winnerName} advances to round ${next.bracket.round}, position ${next.bracket.position}, slot ${side}.` });
      return;
    }

    // League formats — generate playoffs when the league stage completes (§8.1/§10)
    const teams = await this.teamRepository.findByCompetition(match.competitionId);
    const eligible = teams.filter((t) => t.status !== 'rejected' && t.status !== 'banned' && t.status !== 'disbanned' && t.status !== 'disbanded');
    const completed = await this.repo.find({ where: { competitionId: match.competitionId, status: 'completed' } });
    const scheduledCount = await this.repo.count({ where: { competitionId: match.competitionId, status: 'scheduled' } });
    const expectedLeague = roundRobinFixtures(eligible.map((t) => t.name)).length;
    if (expectedLeague > 0 && completed.length < expectedLeague) return; // league not finished

    const standings = computeStandings(eligible.map((t) => t.name), completed as any);
    // Qualification default: top 4 (IPL-style); configurable with QUALIFIERS env
    const qualifiers = Math.max(2, Math.min(4, parseInt(process.env.PLAYOFF_QUALIFIERS || '4', 10)));
    const playoffFixtures = iplPlayoffFixtures(standings, qualifiers);
    if (!playoffFixtures.length) return finishTournament(standings[0]?.team ?? null);

    const existingTeams = new Set<string>(completed.map((m) => m.round || ''));
    if (existingTeams.has('Qualifier 1')) return; // playoffs already generated

    for (const f of playoffFixtures) {
      const playoff = this.repo.create({
        competitionId: match.competitionId,
        team1Name: f.team1Id,
        team2Name: f.team2Id,
        status: 'scheduled',
        round: f.roundLabel,
        createdBy: actor,
      });
      const saved = await this.repo.save(playoff);
      await this.notifyTeams(saved as any, '🏆 Playoffs Generated');
    }
    await this.auditLog.record('PLAYOFFS_GENERATED', {
      actor,
      entityType: 'competition',
      entityId: match.competitionId,
      details: `IPL-style playoffs generated after the league stage (top ${qualifiers} of ${eligible.length} teams).`,
      metadata: { scheduledRemaining: scheduledCount },
    });
  }

  /** §10 — standings for a competition computed from verified completed matches only. */
  async getStandings(competitionId: string) {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) throw new NotFoundException(`Competition ${competitionId} not found`);
    const teams = await this.teamRepository.findByCompetition(competitionId);
    const eligible = teams.filter((t) => t.status !== 'rejected' && t.status !== 'banned' && t.status !== 'disbanded');
    const completed = await this.repo.find({ where: { competitionId, status: 'completed' } });
    return computeStandings(eligible.map((t) => t.name), completed as any);
  }

  async delete(id: string, actor: string): Promise<void> {
    const match = await this.findById(id);
    if (match.bracket?.version === 2) throw new ForbiddenException('Individual bracket positions cannot be deleted.');
    if (match.status === 'completed') {
      throw new ForbiddenException('Completed/verified matches cannot be deleted — match history and results must be preserved.');
    }
    await this.repo.delete(id);
    await this.auditLog.record('MATCH_DELETED', { actor, entityType: 'match', entityId: id, details: `Deleted scheduled match.` });
  }

  async deleteByCompetition(competitionId: string): Promise<void> {
    await this.repo.delete({ competitionId, status: 'completed' as any });
  }
}

/** League detection for §8/§10: a league/playoff competition (IPL-style playoffs). */
function compLeague(competition: any): boolean {
  const t = String(competition?.type || '').toLowerCase();
  const f = String(competition?.format || '').toLowerCase();
  return t === 'league' || f.includes('league') || /playoff/i.test(f);
}


