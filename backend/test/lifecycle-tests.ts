import 'reflect-metadata';
import { strict as assert } from 'assert';
import { randomUUID } from 'crypto';
import { LifecycleService } from '../src/modules/payments/lifecycle.service';
import { prizeDeadline, organizerTrusted, mailSubject, allocatePrizes, standingsGroups } from '../src/modules/payments/payment.rules';
import { CompetitionEntity as Competition } from '../src/entities/competition.entity';
import { PaymentTransactionEntity as Transaction } from '../src/entities/payment-transaction.entity';
import { EscrowAccountEntity as Escrow } from '../src/entities/escrow-account.entity';
import { PaymentMailEntity as Mail } from '../src/entities/payment-mail.entity';
import { NotificationEntity as Notification } from '../src/entities/notification.entity';
import { TeamEntity as Team } from '../src/entities/team.entity';
import { UserEntity as User } from '../src/entities/user.entity';
import { MatchEntity as Match } from '../src/entities/match.entity';

/**
 * In-memory stand-in for the TypeORM EntityManager/DataSource. Like TypeORM,
 * reads return *copies* and save() writes every column of the passed copy, so
 * code that saves a stale copy over a newer row fails these tests.
 */
function memoryDb() {
  const tables = new Map<Function, any[]>();
  const table = (E: Function) => { if (!tables.has(E)) tables.set(E, []); return tables.get(E); };
  const matches = (row: any, where: any) => Object.entries(where || {}).every(([k, v]) => row[k] === v);
  const copy = (row: any) => row && Object.assign(Object.create(Object.getPrototypeOf(row)), JSON.parse(JSON.stringify(row)), reviveDates(row));
  const reviveDates = (row: any) => Object.fromEntries(Object.entries(row).filter(([, v]) => v instanceof Date).map(([k, v]) => [k, new Date(+(v as Date))]));
  const defaults = new Map<Function, any>([
    [Escrow, { prizeMinor: 0, registrationsMinor: 0, payoutsMinor: 0, refundsMinor: 0, balanceMinor: 0, status: 'OPEN' }],
  ]);
  const manager: any = {
    query: async () => undefined,
    create: (E: any, values: any) => Object.assign(new E(), defaults.get(E) || {}, values),
    save: async (value: any) => {
      const rows = table(value.constructor);
      if (!value.id) value.id = randomUUID();
      if (!value.createdAt) value.createdAt = new Date();
      const stored = rows.find(r => r.id === value.id);
      if (!stored) rows.push(value);
      else if (stored !== value) Object.assign(stored, copy(value));
      return value;
    },
    findOne: async (E: Function, options: any) => copy(table(E).find(r => matches(r, options?.where))) || null,
    findOneBy: async (E: Function, where: any) => copy(table(E).find(r => matches(r, where))) || null,
    existsBy: async (E: Function, where: any) => table(E).some(r => matches(r, where)),
    find: async (E: Function, options: any) => table(E).filter(r => matches(r, options?.where)).map(copy),
  };
  const db: any = {
    transaction: (work: any) => work(manager),
    getRepository: (E: Function) => ({
      findOneBy: (where: any) => manager.findOneBy(E, where),
      find: (options: any) => manager.find(E, options),
    }),
  };
  return { db, table, insert: (E: any, values: any) => manager.save(manager.create(E, values)) };
}

const day = 86400000;
const config = (overrides: Record<string, any> = {}) => ({ get: (key: string, fallback?: any) => key in overrides ? overrides[key] : key === 'NODE_ENV' ? 'development' : fallback }) as any;

async function rejects(work: () => Promise<any>, pattern: RegExp, status?: number) {
  try { await work(); } catch (error) {
    assert.match(error.message, pattern);
    if (status) assert.equal(error.getStatus(), status);
    return;
  }
  assert.fail(`Expected rejection matching ${pattern}`);
}

async function run() {
  // Pure rules
  assert.equal(+prizeDeadline('2026-01-03T00:00:00Z', 48), +new Date('2026-01-01T00:00:00Z'));
  assert.equal(+prizeDeadline('2026-01-03T00:00:00Z', 0), +new Date('2026-01-03T00:00:00Z'));
  assert.equal(+prizeDeadline('2026-01-03T00:00:00Z', NaN), +new Date('2026-01-03T00:00:00Z'));
  assert(organizerTrusted(undefined)); assert(organizerTrusted(50)); assert(!organizerTrusted(49));
  assert.match(mailSubject('refund-apology', 'Cup'), /Apology: Cup has been cancelled/);
  assert.equal(mailSubject('custom-template', 'Cup'), 'custom template');
  // Prize allocation: ties share the places they occupy; unfilled places are unawarded.
  assert.deepEqual(allocatePrizes([600, 400], [['a'], ['b']]), { allocations: [{ teamId: 'a', amount: 600, label: '#1' }, { teamId: 'b', amount: 400, label: '#2' }], unawarded: 0 });
  assert.deepEqual(allocatePrizes([600, 400, 201], [['b', 'a']]), { allocations: [{ teamId: 'a', amount: 500, label: 'joint #1' }, { teamId: 'b', amount: 500, label: 'joint #1' }], unawarded: 201 });
  assert.deepEqual(allocatePrizes([500, 300, 101], [['a'], ['c', 'b']]).allocations.map(x => [x.teamId, x.amount]), [['a', 500], ['b', 201], ['c', 200]]);
  assert.deepEqual(allocatePrizes([1000], [['a'], ['b'], ['c']]).allocations.map(x => x.teamId), ['a']);
  assert.deepEqual(standingsGroups([{ team: 'x', pts: 3, w: 1 }, { team: 'y', pts: 1, w: 0 }, { team: 'z', pts: 1, w: 0 }, { team: 'w', pts: 1, w: 1 }], r => r.team), [['x'], ['w'], ['y', 'z']]);

  const { db, table, insert } = memoryDb();
  const service = new LifecycleService(db, config());
  for (const username of ['org', 'p1', 'p2', 'p3', 'p4']) await insert(User, { username, role: 'participant', verificationStatus: 'verified', banned: false, organizerTrustScore: 100 });
  const org = { username: 'org', role: 'participant' };
  const p1 = { username: 'p1', role: 'participant' };
  const p2 = { username: 'p2', role: 'participant' };
  const p3 = { username: 'p3', role: 'participant' };
  const finance = { username: 'fin', role: 'finance_moderator' };
  const playingFinance = { username: 'p2', role: 'finance_moderator' };
  const tx = (where: any) => table(Transaction).filter(t => Object.entries(where).every(([k, v]) => t[k] === v));
  const user = (name: string) => table(User).find(u => u.username === name);

  const comp: any = await insert(Competition, {
    name: 'Escrow Cup', createdBy: 'org', organizers: ['org'], paymentStatus: 'OPEN_FOR_REGISTRATION', status: 'active',
    organizerPaid: true, prizePoolPaid: false, prize: 1000, feeType: 'per_team', entryFeeAmount: 100, visibility: 'public',
    maxTeams: 0, maxPlayersPerTeam: 0, prizeDistributionMinor: [60000, 40000], startDate: new Date(Date.now() + 3 * day), endDate: new Date(Date.now() + 6 * day), financeHold: false,
  });

  // Registration fees are escrowed exactly once per team, even on retry.
  const alpha: any = await service.registerTeam({ competitionId: comp.id, name: 'Alpha', members: ['p4'] }, p1);
  assert.equal((await service.registerTeam({ competitionId: comp.id, name: 'Alpha' }, p1)).id, alpha.id);
  const bravo: any = await service.registerTeam({ competitionId: comp.id, name: 'Bravo' }, p2);
  const charlie: any = await service.registerTeam({ competitionId: comp.id, name: 'Charlie' }, p3);
  await rejects(() => service.registerTeam({ competitionId: comp.id, name: 'Org team' }, org), /Organizers cannot register/);
  await rejects(() => service.registerTeam({ competitionId: comp.id, name: 'Twice' }, { username: 'p4', role: 'participant' }), /already in a team/);
  const escrow = table(Escrow)[0];
  assert.equal(escrow.registrationsMinor, 30000);
  assert.equal(escrow.balanceMinor, 30000);
  assert.equal(tx({ type: 'REGISTRATION', status: 'ESCROWED' }).length, 3);
  assert(table(Mail).some(m => m.username === 'p1' && m.template === 'registration-confirmed'));

  // Prize pool: owner only, failed attempt changes nothing, retries are idempotent.
  await rejects(() => service.end(comp.id, org), /Pay the prize pool/, 402);
  await rejects(() => service.prize(comp.id, p1), /Only this competition/);
  assert.equal((await service.prize(comp.id, org, 'failed')).status, 'FAILED');
  assert.equal(comp.prizePoolPaid, false);
  await service.prize(comp.id, org);
  assert.equal((await service.prize(comp.id, org)).duplicate, true);
  assert.equal(escrow.balanceMinor, 130000);
  await rejects(() => service.end(comp.id, org), /not started/);

  comp.startDate = new Date(Date.now() - day);
  const final: any = await insert(Match, { competitionId: comp.id, round: 'Final', status: 'completed', team1Id: alpha.id, team2Id: bravo.id, winnerId: alpha.id });

  // CHEAT: leaving a paying team out of the fixtures.
  await rejects(() => service.end(comp.id, org), /Charlie never appeared in the fixtures/);

  // CHEAT: banning a paying team. Its fee goes back to its players, not to the organizer.
  comp.startDate = new Date(Date.now() + day); // removals happen before results are final
  await service.removeTeam(charlie.id, org, 'banned', 'Toxic behaviour');
  assert.equal(table(Team).find(t => t.id === charlie.id).status, 'banned');
  assert.equal(tx({ type: 'REFUND', userUsername: 'p3' })[0].amountMinor, 10000);
  assert.equal(escrow.balanceMinor, 120000);
  const banNote = table(Notification).find(n => n.toUsername === 'p3' && n.type === 'registration-refunded');
  assert(banNote && banNote.title === `Registration fee refunded for ${comp.name}` && /₹100 has been refunded/.test(banNote.body));
  comp.startDate = new Date(Date.now() - day);

  // CHEAT: a fabricated second "Final".
  const fake: any = await insert(Match, { competitionId: comp.id, round: 'Final', status: 'completed', team1Id: bravo.id, team2Id: alpha.id, winnerId: bravo.id });
  await rejects(() => service.end(comp.id, org), /Exactly one completed final/);
  table(Match).splice(table(Match).indexOf(fake), 1);

  await service.end(comp.id, org);
  assert.equal(comp.paymentStatus, 'COMPLETED');
  assert(table(Mail).some(m => m.username === 'p4' && m.template === 'tournament-completed' && /raise a dispute before/.test(m.body)));
  await rejects(() => service.cancel(comp.id, org, 'Changed my mind'), /Only a finance moderator/);
  await rejects(() => service.removeTeam(bravo.id, org, 'banned', 'Lost the final'), /Results are final/);

  // Settlement is finance-only, neutral, waits for the dispute window and respects holds.
  await rejects(() => service.settle(comp.id, org), /Finance moderator access/);
  await rejects(() => service.settle(comp.id, finance), /Players can dispute the results until/);
  await service.mockCloseDisputeWindow(comp.id, finance);
  await rejects(() => service.settle(comp.id, playingFinance), /Conflict of interest: you play/);
  await rejects(() => service.hold(comp.id, playingFinance, true, 'Self-serving hold'), /Conflict of interest/);
  await service.hold(comp.id, finance, true, 'Checking a complaint');
  await rejects(() => service.settle(comp.id, finance), /finance holds/);
  await service.hold(comp.id, finance, false, 'Complaint cleared');
  await service.settle(comp.id, finance);
  assert.equal(comp.paymentStatus, 'PRIZE_RELEASED');
  assert.equal(escrow.balanceMinor, 0);
  assert.equal(escrow.status, 'RELEASED');

  // Team prizes are split equally between members; the captain can't keep it all.
  const payouts = tx({ type: 'PAYOUT', competitionId: comp.id });
  assert.deepEqual(payouts.map(t => [t.userUsername, t.amountMinor]).sort(), [['p1', 30000], ['p2', 40000], ['p4', 30000]]);
  assert(!payouts.some(t => t.userUsername === 'p3'));
  // Only fees of teams still in the competition are released to the organizer.
  assert.equal(tx({ type: 'REG_FEE_RELEASED', competitionId: comp.id })[0].amountMinor, 20000);
  assert.equal((await service.settle(comp.id, finance)).duplicate, true);
  assert.equal(tx({ type: 'PAYOUT', competitionId: comp.id }).length, 3);

  // Fraud reversal claws back released revenue and refunds every remaining player.
  await rejects(() => service.reverse(comp.id, org, 'Fraud'), /Finance moderator access/);
  await service.reverse(comp.id, finance, 'Match fixing proven');
  assert.equal(comp.paymentStatus, 'REVERSED');
  assert.equal(escrow.balanceMinor, 0);
  assert.equal(escrow.refundsMinor, 30000);
  assert.equal(escrow.status, 'REVERSED');
  assert.equal(tx({ type: 'CLAWBACK' })[0].amountMinor, 20000);
  assert.equal(tx({ type: 'REFUND', competitionId: comp.id }).length, 3);
  assert(tx({ type: 'REGISTRATION', competitionId: comp.id }).every(t => t.status === 'REFUNDED'));
  assert.equal(user('org').organizerTrustScore, 75);
  // Finance can review (restore) a trust score; neutral finance only, reason audited, organizer notified.
  await rejects(() => service.reviewTrust(comp.id, org, 100, 'Restoring my own score'), /Finance moderator access/);
  await rejects(() => service.reviewTrust(comp.id, playingFinance, 100, 'Restoring the organizer'), /Conflict of interest/);
  await rejects(() => service.reviewTrust(comp.id, finance, 101, 'Out of range score'), /0 to 100/);
  await service.reviewTrust(comp.id, finance, 90, 'Cancellations were caused by a venue outage');
  assert.equal(user('org').organizerTrustScore, 90);
  assert(table(Notification).some(n => n.toUsername === 'org' && n.type === 'trust-score-reviewed' && /75 → 90/.test(n.body) && /can create competitions/.test(n.body)));
  await service.reviewTrust(comp.id, finance, 75, 'Back to the post-reversal score for the rest of this test');
  assert.equal((await service.reverse(comp.id, finance, 'again')).duplicate, true);
  assert.equal(tx({ type: 'REFUND', competitionId: comp.id }).length, 3);

  // Settles a competition end to end and returns its payouts as [username, paise] pairs.
  const settleScenario = async (fields: any, entrants: any[], playMatches: (teams: any[]) => any[]) => {
    const c: any = await insert(Competition, {
      createdBy: 'org', organizers: ['org'], paymentStatus: 'OPEN_FOR_REGISTRATION', status: 'active', organizerPaid: true, prizePoolPaid: false,
      feeType: 'per_team', entryFeeAmount: 10, visibility: 'public', maxTeams: 0, maxPlayersPerTeam: 0, financeHold: false,
      startDate: new Date(Date.now() + day), endDate: new Date(Date.now() + 3 * day), ...fields,
    });
    const teams = [];
    for (const [captain, name] of entrants) teams.push(await service.registerTeam({ competitionId: c.id, name }, captain));
    await service.prize(c.id, org);
    c.startDate = new Date(Date.now() - 1000);
    for (const match of playMatches(teams)) await insert(Match, { competitionId: c.id, status: 'completed', ...match });
    await service.end(c.id, org);
    await service.mockCloseDisputeWindow(c.id, finance);
    await service.settle(c.id, finance);
    assert.equal(table(Escrow).find(e => e.competitionId === c.id).balanceMinor, 0);
    return { c, payouts: tx({ competitionId: c.id, type: 'PAYOUT' }).map(t => [t.userUsername, t.amountMinor]).sort(), returned: tx({ competitionId: c.id, type: 'PRIZE_RETURN' }).map(t => t.amountMinor) };
  };
  const vs = (a: any, b: any, winner: any, round = 'Round 1') => ({ round, team1Id: a.id, team2Id: b.id, team1Name: a.name, team2Name: b.name, winnerId: winner?.id || null, winnerName: winner?.name || null });

  // League, 2 teams, the only match is a draw, 3 prize places: the tied teams share 1st + 2nd; 3rd goes back to the organizer.
  const drawn = await settleScenario({ name: 'Draw League', type: 'league', format: 'Round Robin', prize: 1500, prizeDistributionMinor: [80000, 50000, 20000] },
    [[p1, 'Lions'], [p2, 'Tigers']], ([lions, tigers]) => [vs(lions, tigers, null)]);
  assert.deepEqual(drawn.payouts, [['p1', 65000], ['p2', 65000]]);
  assert.deepEqual(drawn.returned, [20000]);
  // Every money movement lands in the recipient's in-app notifications as an informational update.
  const notes = (username: string, type: string) => table(Notification).filter(n => n.toUsername === username && n.type === type && n.meta?.compId === drawn.c.id);
  for (const winner of ['p1', 'p2']) {
    const [note] = notes(winner, 'winner-payout');
    assert(note, `${winner} was not notified of the payout`);
    assert.equal(note.status, 'info');
    assert.match(note.body, /Your share: ₹650/);
  }
  const [revenue] = notes('org', 'organizer-revenue-released');
  assert.match(revenue.body, /Registration revenue of ₹20 from 2 registration/);
  assert.match(revenue.body, /₹200 of the prize pool was for places no team could fill/);
  assert.equal(notes('org', 'tournament-completed').length, 1, 'organizer is told the dispute window opened');
  assert(table(Notification).filter(n => n.meta?.category === 'payment').every(n => n.status === 'info' && !/^Mock: /.test(n.body)));

  // League, 3 teams: Lions win twice; Tigers and Bears draw and are level, so they share 2nd + 3rd.
  const table3 = await settleScenario({ name: 'Table League', type: 'league', format: 'Round Robin', prize: 1000, prizeDistributionMinor: [60000, 30000, 10000] },
    [[p1, 'Lions'], [p2, 'Tigers'], [p3, 'Bears']], ([lions, tigers, bears]) => [vs(lions, tigers, lions), vs(lions, bears, lions), vs(tigers, bears, null)]);
  assert.deepEqual(table3.payouts, [['p1', 60000], ['p2', 20000], ['p3', 20000]]);
  assert.deepEqual(table3.returned, []);

  // Knockout bracket, 4 teams: winner, runner-up, then the two semi-final losers share 3rd.
  const knockout = await settleScenario({ name: 'Bracket Cup', type: 'tournament', format: 'Single Elimination', prize: 1000, prizeDistributionMinor: [50000, 30000, 20000] },
    [[p1, 'Kings'], [p2, 'Queens'], [p3, 'Rooks'], [{ username: 'p4', role: 'participant' }, 'Pawns']], ([kings, queens, rooks, pawns]) => {
      const finalId = randomUUID();
      return [
        { ...vs(kings, pawns, kings, 'Semi Final'), bracket: { version: 2, nextMatchId: finalId } },
        { ...vs(queens, rooks, queens, 'Semi Final'), bracket: { version: 2, nextMatchId: finalId } },
        { ...vs(kings, queens, kings, 'Final'), id: finalId, bracket: { version: 2, nextMatchId: null } },
      ];
    });
  assert.deepEqual(knockout.payouts, [['p1', 50000], ['p2', 30000], ['p3', 10000], ['p4', 10000]]);

  // Cancelling an unpaid draft forfeits nothing and does not penalise the organizer.
  const draft: any = await insert(Competition, { name: 'Draft', createdBy: 'org', organizers: ['org'], paymentStatus: 'AWAITING_PLATFORM_FEE', organizerPaid: false, startDate: new Date(Date.now() + 5 * day) });
  await service.cancel(draft.id, org, 'No longer needed');
  assert.equal(draft.paymentStatus, 'CANCELLED');
  assert.equal(user('org').organizerTrustScore, 75);

  // Cancelling after registrations refunds players, holds the prize, and penalises the organizer.
  const second: any = await insert(Competition, {
    name: 'Second Cup', createdBy: 'org', organizers: ['org'], paymentStatus: 'OPEN_FOR_REGISTRATION', status: 'active',
    organizerPaid: true, prizePoolPaid: false, prize: 500, feeType: 'per_team', entryFeeAmount: 50, visibility: 'public',
    maxTeams: 0, maxPlayersPerTeam: 0, startDate: new Date(Date.now() + 3 * day),
  });
  await service.registerTeam({ competitionId: second.id, name: 'Delta' }, p1);
  const leaver: any = await service.registerTeam({ competitionId: second.id, name: 'Echo' }, p2);
  await service.disband(leaver.id, p2, 'We cannot make the dates');
  await service.prize(second.id, org);
  await rejects(() => service.cancel(second.id, playingFinance, 'conflict'), /Conflict of interest/);
  await service.cancel(second.id, org, 'Venue unavailable');
  const secondEscrow = table(Escrow).find(e => e.competitionId === second.id);
  assert.equal(second.paymentStatus, 'REFUND_ISSUED');
  assert.equal(secondEscrow.status, 'HELD');
  assert.equal(secondEscrow.balanceMinor, 50000);
  assert.equal(user('org').organizerTrustScore, 65);
  assert(table(Mail).some(m => m.username === 'p1' && m.template === 'refund-apology' && m.competitionId === second.id));
  assert(table(Notification).some(n => n.toUsername === 'p1' && n.type === 'refund-apology' && n.meta?.compId === second.id && /refunded in full/.test(n.body)), 'refund reaches the player\'s notifications');
  await service.releaseHeldPrize(second.id, finance, 'Compensate affected players');
  assert.equal(secondEscrow.balanceMinor, 0);
  // Only players still in the competition at cancellation are compensated (p2 left voluntarily).
  assert.deepEqual(tx({ competitionId: second.id, type: 'PAYOUT' }).map(t => [t.userUsername, t.amountMinor]), [['p1', 50000]]);

  // A configured funding deadline closes prize deposits before the start date.
  const strict = new LifecycleService(db, config({ AUTO_CANCEL_HOURS_BEFORE_START: 48 }));
  const soon: any = await insert(Competition, { name: 'Soon', createdBy: 'org', organizers: ['org'], paymentStatus: 'OPEN_FOR_REGISTRATION', organizerPaid: true, prizePoolPaid: false, prize: 100, startDate: new Date(Date.now() + day) });
  await rejects(() => strict.prize(soon.id, org), /funding deadline/);

  // Testing tool: only organizers/finance can move a published competition's start to now.
  const later: any = await insert(Competition, { name: 'Later', createdBy: 'org', organizers: ['org'], paymentStatus: 'OPEN_FOR_REGISTRATION', organizerPaid: true, prize: 100, startDate: new Date(Date.now() + 5 * day), registrationCloseAt: new Date(Date.now() + 4 * day) });
  await rejects(() => service.mockStartNow(later.id, p1), /Only this competition/);
  await service.mockStartNow(later.id, org);
  assert(+later.startDate <= Date.now() && +later.registrationCloseAt <= Date.now());
  assert.equal((await service.mockStartNow(later.id, org)).duplicate, true);
  await rejects(() => service.mockStartNow(draft.id, org), /published, active/);

  // Mock lifecycle refuses to run in production.
  await rejects(() => new LifecycleService(db, config({ NODE_ENV: 'production' })).prize(soon.id, org), /mock payment mode/);

  console.log('Lifecycle tests passed: escrow, prize funding, 402 end gate, dispute window, neutrality, holds, fixture integrity, team removal refunds, member prize split, league standings, ties, unfilled places, knockout places, settlement, fraud reversal, trust review, refunds, deadlines.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
