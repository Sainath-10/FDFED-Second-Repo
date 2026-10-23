import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  roundLabel,
} from '../../common/tournament/tournament.utils';

const DEFAULT_MATCH_DURATION_MINUTES = 60;   // §8.2 — configurable via env MATCH_DURATION_MINUTES
const DEFAULT_INTERVAL_MINUTES = 30;         // configurable via env MATCH_INTERVAL_MINUTES

@Injectable()
export class MatchesService {
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

    const match = this.repo.create({ ...data, status: 'scheduled' });
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
    if ((match as any).winnerId) {
      throw new ForbiddenException('Verified/completed results cannot be modified through scheduling.');
    }
    if (updates.scheduledAt) {
      const comp = await this.competitionRepository.findById(match.competitionId);
      if (!comp) throw new NotFoundException('Competition not found');
      const existing = await this.repo.find({ where: { competitionId: match.competitionId } });
      const conflicts = findScheduleConflicts(
        { team1Id: match.team1Id, team2Id: match.team2Id, scheduledAt: updates.scheduledAt, matchId: id, competitionId: match.competitionId },
        existing as any,
        { start: new Date(comp.startDate), end: new Date(comp.endDate) },
        this.matchDurationMinutes(),
      );
      if (conflicts.length) throw new BadRequestException(conflicts.join(' '));
    }
    const safe: Partial<MatchEntity> = {};
    if (updates.scheduledAt) safe.scheduledAt = updates.scheduledAt;
    if (updates.round) safe.round = updates.round;
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
  async generateSchedule(competitionId: string, actor: string, options: { confirmOverlap?: boolean; matchDurationMinutes?: number; intervalMinutes?: number; dailyWindow?: boolean } = {}): Promise<{ created: number; skipped: number; protectedCompleted: number; requiresConfirmation?: boolean }> {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) throw new NotFoundException(`Competition ${competitionId} not found`);

    const teams = await this.teamRepository.findByCompetition(competitionId);
    const eligible = teams.filter((t) => t.status !== 'rejected' && t.status !== 'banned' && t.status !== 'disbanded');
    const teamNames = eligible.map((t) => t.name);

    if (teamNames.length < 2) {
      throw new BadRequestException('At least 2 eligible registered teams are required to generate a schedule.');
    }

    const existing = await this.repo.find({ where: { competitionId } });
    const completed = existing.filter((m) => m.status === 'completed');
    const scheduled = existing.filter((m) => m.status !== 'completed');

    // Detect whether regenerating would change existing scheduled fixtures
    const format = this.resolveFormat(competition);
    let planned: { team1Id: string; team2Id: string; roundLabel?: string }[] = [];
    if (format === 'round_robin' || format === 'league') {
      planned = roundRobinFixtures(teamNames).map((f) => ({ team1Id: f.team1Id, team2Id: f.team2Id, roundLabel: f.roundLabel }));
    } else {
      const bracket = eliminationPairings(teamNames, { doubleElimination: /double/i.test(String(competition.format || '')) });
      planned = bracket.firstRound.map((f) => ({ team1Id: f.team1Id, team2Id: f.team2Id, roundLabel: f.roundLabel }));
    }

    const teamNameById = new Map(eligible.map((t) => [t.id, t.name]));
    const nameToId = new Map(eligible.map((t) => [t.id, t.id]));

    // Fixtures already covered by completed/scheduled matches will not be duplicated
    const covered = new Set<string>();
    const key = (t1, t2, label) => [t1, t2, label || ''].join('|');
    existing.forEach((m) => {
      const n1 = m.team1Name || teamNameById.get(m.team1Id) || '';
      const n2 = m.team2Name || teamNameById.get(m.team2Id) || '';
      covered.add(key(n1, n2, m.round));
      covered.add(key(n2, n1, m.round));
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
      .filter((p) => !covered.has(key(teamNameById.get(p.team1Id as string), teamNameById.get(p.team2Id as string), p.roundLabel as string)));

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
    if ((match as any).winnerId) {
      throw new BadRequestException('A verified result already exists for this match. Duplicate submissions are rejected.');
    }
    if (!score || !String(score).trim()) throw new BadRequestException('A score is required to record a result.');

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
      resolvedName = String(winnerName);
    }

    await this.repo.update(id, {
      winnerId: noWinner ? null : winnerId,
      winnerName: noWinner ? null : resolvedName,
      score,
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
      // elimination bracket: create next-round match with winner vs winner of sibling
      const all = await this.repo.find({ where: { competitionId: match.competitionId } });
      const thisRoundNum = roundNumber(match.round);
      const thisLabel = match.round || '';
      if (isFinalLabel(thisLabel, all)) {
        return finishTournament(match.winnerName || null);
      }
      // find a sibling completed match in the same round that shares no team with this match
      const siblings = all.filter(
        (m) => (m as any).id !== (match as any).id && m.round === match.round && m.status === 'completed' && (m as any).winnerId,
      );
      if (siblings.length === 0) return; // waiting on sibling result
      const partner = siblings.find((s) => !sharesTeam(s, match));
      if (!partner) return;
      const nextRoundLabel = roundLabel(thisRoundNum + 1, Math.max(3, thisRoundNum + 2), /double/i.test(String(competition.format || '')));
      const wA = match.winnerName;
      const wB = partner.winnerName;
      // avoid duplicates: same two winners already playing in any round
      const dup = all.some((m) => (m.team1Name === wA && m.team2Name === wB) || (m.team1Name === wB && m.team2Name === wA));
      if (dup) return;

      // resolve winner team ids by name for reliable advancement
      const teams = await this.teamRepository.findByCompetition(match.competitionId);
      const idOf = (name) => (teams.find((t) => t.name?.toLowerCase() === String(name).toLowerCase())?.id ?? undefined);
      const next = this.repo.create({
        competitionId: match.competitionId,
        team1Id: idOf(wA),
        team2Id: idOf(wB),
        team1Name: wA,
        team2Name: wB,
        status: 'scheduled',
        round: nextRoundLabel,
        createdBy: actor,
      });
      const savedNext = await this.repo.save(next);
      await this.auditLog.record('BRACKET_ADVANCED', {
        actor,
        entityType: 'match',
        entityId: (savedNext as any).id,
        details: `${wA} and ${wB} advanced to ${nextRoundLabel}.`,
      });
      await this.notifyTeams(savedNext as any, '🏆 Bracket Advanced', `${wA} and ${wB} advanced to ${nextRoundLabel}.`);
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

function sharesTeam(a: any, b: any): boolean {
  const aTeams = [a.team1Name, a.team2Name].filter(Boolean);
  const bTeams = [b.team1Name, b.team2Name].filter(Boolean);
  return aTeams.some((t) => bTeams.includes(t));
}

let cachedTeamIds: { id: string; name: string }[] = [];

function roundNumber(label: string): number {
  const m = /round\s+(\d+)/i.exec(label || '');
  return m ? parseInt(m[1], 10) : 1;
}

function isFinalLabel(label: string, all: MatchEntity[]): boolean {
  const l = String(label || '').toLowerCase();
  if (l.includes('final')) return true;
  // Simple heuristic: this match has the only non-completed opponent count of 1 team short (end of bracket)
  const withSameRound = all.filter((m) => m.round === label);
  return Boolean(
    withSameRound.length === 1 && withSameRound[0].team1Id && withSameRound[0].team2Id,
  );
}

/** League detection for §8/§10: a league/playoff competition (IPL-style playoffs). */
function compLeague(competition: any): boolean {
  const t = String(competition?.type || '').toLowerCase();
  const f = String(competition?.format || '').toLowerCase();
  return t === 'league' || f.includes('league') || /playoff/i.test(f);
}


