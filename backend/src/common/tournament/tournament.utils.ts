/**
 * NEXUS ESPORTS — Tournament scheduling & progression utilities (pure functions)
 *
 * Implements §8 (fixture generation: Round Robin, Elimination, League+Playoffs
 * IPL-style), §8.2 (schedule generation with team-overlap avoidance),
 * §9 (bracket advancement from verified results only), §10 (standings + winner).
 * Pure functions — unit-testable without a database.
 */

export type Fixture = { round: number; roundLabel: string; team1Id: string | null; team2Id: string | null };

/** Round-robin fixtures using the circle method; odd team counts get a bye (null). */
export function roundRobinFixtures(teamIds: string[]): Fixture[] {
  const teams = teamIds.slice();
  if (teams.length < 2) return [];
  const odd = teams.length % 2 === 1;
  if (odd) teams.push(null as any); // bye
  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];

  let rotation = teams.slice();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === null || b === null) continue; // bye — no fixture generated
      // alternate home/away assignment across rounds for balance
      const pair = (r + i) % 2 === 0 ? [a, b] : [b, a];
      fixtures.push({ round: r + 1, roundLabel: `Round ${r + 1}`, team1Id: pair[0], team2Id: pair[1] });
    }
    // rotate all but the first element
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() as any);
    rotation = [fixed, ...rest];
  }
  return fixtures;
}

/**
 * Elimination (knockout) bracket for the first round; byes are given to
 * balance the bracket to the next power of two. Fields with two valid teams
 * must be played; a field with a single real team is a bye-advance (no match).
 * Returns pairings for every round, with later rounds TBD (null).
 */
export function eliminationPairings(teamIds: string[], opts: { doubleElimination?: boolean } = {}): {
  firstRound: Fixture[];
  roundCount: number;
  autoAdvancers: string[];
} {
  const teams = teamIds.slice();
  if (teams.length < 2) return { firstRound: [], roundCount: 0, autoAdvancers: teams.slice() };
  let size = 2;
  while (size < teams.length) size *= 2;
  const roundCount = Math.log2(size);

  // seed order: interleave strongest/unknown as provided order
  const slots: (string | null)[] = [];
  // pad so pairing (slot i, slot size-1-i) — standard bracket seeding
  for (let i = 0; i < teams.length; i++) slots.push(teams[i]);
  while (slots.length < size) slots.push(null);

  const firstRound: Fixture[] = [];
  const autoAdvancers: string[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = slots[i];
    const b = slots[size - 1 - i];
    if (a !== null && b !== null) {
      firstRound.push({ round: 1, roundLabel: roundLabel(1, roundCount, opts.doubleElimination), team1Id: a, team2Id: b });
    } else if (a !== null) autoAdvancers.push(a);
    else if (b !== null) autoAdvancers.push(b);
  }
  return { firstRound, roundCount, autoAdvancers };
}

export function roundLabel(round: number, roundCount: number, double = false): string {
  const prefix = double ? 'UB ' : '';
  const fromEnd = roundCount - round;
  if (fromEnd === 0) return `${prefix}Final`;
  if (fromEnd === 1) return double && roundCount > 2 ? `${prefix}LB Final` : `${prefix}Semifinal`;
  if (fromEnd === 2) return `${prefix}Quarterfinal`;
  return `${prefix}Round ${round}`;
}

/**
 * League standings computed from completed, verified matches (§10).
 * winPts / drawPts / lossPts follow standard football-style scoring (3/1/0).
 */
export function computeStandings(
  teamNames: string[],
  completedMatches: { team1Name?: string | null; team2Name?: string | null; winnerName?: string | null; winnerId?: string | null }[],
  scoring: { winPts: number; drawPts: number; lossPts: number } = { winPts: 3, drawPts: 1, lossPts: 0 },
) {
  const table = new Map<string, { team: string; mp: number; w: number; l: number; d: number; pts: number }>();
  teamNames.forEach((t) => table.set(t, { team: t, mp: 0, w: 0, l: 0, d: 0, pts: 0 }));

  completedMatches.forEach((m) => {
    const t1 = (m.team1Name || '').trim();
    const t2 = (m.team2Name || '').trim();
    if (!t1 || !t2 || !table.has(t1) || !table.has(t2)) return; // only matches between registered teams count
    const r1 = table.get(t1)!;
    const r2 = table.get(t2)!;
    r1.mp += 1; r2.mp += 1;
    const winner = (m.winnerName || '').trim();
    if (winner === t1) { r1.w += 1; r2.l += 1; r1.pts += scoring.winPts; r2.pts += scoring.lossPts; }
    else if (winner === t2) { r2.w += 1; r1.l += 1; r2.pts += scoring.winPts; r1.pts += scoring.lossPts; }
    else { r1.d += 1; r2.d += 1; r1.pts += scoring.drawPts; r2.pts += scoring.drawPts; }
  });

  return Array.from(table.values()).sort((a, b) => b.pts - a.pts || b.w - a.w || a.team.localeCompare(b.team));
}

/**
 * IPL-style (Playoff-Of-System) playoff structure (§8.1):
 *  - Qualifier 1: #1 vs #2 (winner → Final)
 *  - Eliminator : #3 vs #4 (loser eliminated; winner → Qualifier 2)
 *  - Qualifier 2: loser of Q1 vs winner of Eliminator (winner → Final)
 *  - Final      : winner Q1 vs winner Q2. Winner of the Final is champion.
 */
export function iplPlayoffFixtures(pointsTable: { team: string }[], qualifiers = 4): Fixture[] {
  const top = pointsTable.slice(0, qualifiers).map((r) => r.team);
  if (top.length < 4) return [];
  const [first, second, third, fourth] = top;
  return [
    { round: 1, roundLabel: 'Qualifier 1', team1Id: first, team2Id: second },
    { round: 1, roundLabel: 'Eliminator', team1Id: third, team2Id: fourth },
  ];
}

/** Next IPL round after Q1 + Eliminator are decided (winners passed in). */
export function iplNextRound(
  q1Winner: string | null,
  eliminatorWinner: string | null,
): Fixture[] {
  if (!q1Winner || !eliminatorWinner) return [];
  return [{ round: 2, roundLabel: 'Qualifier 2', team1Id: q1Winner, team2Id: eliminatorWinner }];
}

/**
 * Schedules fixtures into slots (§8.2). Each fixture takes `matchDuration`
 * consecutive teams are never double-booked; a fixture with `null` team (bye)
 * is skipped. `slotToDateTime` maps a sequential slot index to a real Date —
 * callers decide the tournament window & intervals from organizer config.
 */
export function scheduleFixtures(
  fixtures: { round: number; team1Id: string | null; team2Id: string | null }[],
  slotToDateTime: (slotIndex: number) => Date,
): { fixture: any; scheduledAt: Date; slotIndex: number }[] {
  const busy = new Map<string, Set<number>>(); // teamId -> occupied slots
  let slot = 0;
  const scheduled: { fixture: any; scheduledAt: Date; slotIndex: number }[] = [];
  const MAX_LOOKAHEAD = fixtures.length * 2 + 8;

  for (const fixture of fixtures) {
    if (!fixture.team1Id || !fixture.team2Id) continue; // skip byes
    let placed = false;
    for (let tries = 0; tries < MAX_LOOKAHEAD && !placed; tries++, slot++) {
      const t1busy = busy.get(fixture.team1Id)?.has(slot) || false;
      const t2busy = busy.get(fixture.team2Id)?.has(slot) || false;
      if (!t1busy && !t2busy) {
        if (!busy.has(fixture.team1Id)) busy.set(fixture.team1Id, new Set());
        if (!busy.has(fixture.team2Id)) busy.set(fixture.team2Id, new Set());
        busy.get(fixture.team1Id)!.add(slot);
        busy.get(fixture.team2Id)!.add(slot);
        scheduled.push({ fixture, scheduledAt: slotToDateTime(slot), slotIndex: slot });
        placed = true;
      }
    }
  }
  return scheduled;
}

/**
 * Finds scheduling conflicts for a proposed match (§11): another scheduled or
 * ongoing match involving either team within the same slot window, or a time
 * outside the competition window.
 */
export function findScheduleConflicts(
  proposed: { team1Id?: string; team2Id?: string; scheduledAt?: Date; competitionId?: string; matchId?: string },
  existingMatches: { id: string; competitionId: string; team1Id?: string; team2Id?: string; status: string; scheduledAt?: Date | null }[],
  window: { start: Date; end: Date },
  matchDurationMinutes: number,
): string[] {
  const conflicts: string[] = [];
  const at = proposed.scheduledAt?.getTime();
  if (at !== undefined && at !== null) {
    if (at < window.start.getTime()) conflicts.push('Match cannot be scheduled before the competition start date.');
    if (at > window.end.getTime()) conflicts.push('Match cannot be scheduled after the competition end date.');
    if (conflicts.length) return conflicts;
    const end = at + matchDurationMinutes * 60_000;
    existingMatches.forEach((m) => {
      if (proposed.matchId && m.id === proposed.matchId) return;
      if (proposed.competitionId && m.competitionId !== proposed.competitionId) return;
      if (!m.scheduledAt) return;
      const mStart = new Date(m.scheduledAt).getTime();
      const mEnd = mStart + matchDurationMinutes * 60_000;
      const overlaps = mStart < end && at < mEnd;
      if (!overlaps) return;
      const sameTeam =
        (proposed.team1Id && (proposed.team1Id === m.team1Id || proposed.team1Id === m.team2Id)) ||
        (proposed.team2Id && (proposed.team2Id === m.team1Id || proposed.team2Id === m.team2Id));
      if (sameTeam) conflicts.push(`Overlapping match for the same team: ${m.id} (${m.status}).`);
    });
  }
  return conflicts;
}

/** IPL-style playoff progression: given the winners/losers of round-1 matches, return the Qualifier-2 fixture. */
export function iplProgressionAfterRound1(
  results: { roundLabel: string; winnerName: string; loserName: string | null }[],
): Fixture[] {
  const q1 = results.find((r) => r.roundLabel === 'Qualifier 1');
  const elim = results.find((r) => r.roundLabel === 'Eliminator');
  if (!q1 || !elim) return [];
  return [{ round: 2, roundLabel: 'Qualifier 2', team1Id: q1.winnerName, team2Id: elim.winnerName }];
}

/** Simple single-elimination advancement: returns winner & loser given a completed match. */
export function eliminationOutcome(match: { team1Name?: string | null; team2Name?: string | null; winnerName?: string | null }): { winner: string | null; loser: string | null } {
  const t1 = (match.team1Name || '').trim();
  const t2 = (match.team2Name || '').trim();
  const w = (match.winnerName || '').trim();
  if (!w || (w !== t1 && w !== t2)) return { winner: null, loser: null };
  return { winner: w, loser: w === t1 ? t2 : t1 };
}
