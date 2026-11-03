/**
 * NEXUS ESPORTS — automated workflow tests (§17)
 *
 * Run with: npm test (backend)
 *
 * These are service-level unit tests with in-memory fakes for the TypeORM
 * repositories, so they exercise the real business rules without requiring a
 * PostgreSQL instance. No identity document or OTP values are logged.
 */
import 'reflect-metadata';
import assert = require('node:assert/strict');
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import {
  MAX_PRIZE_POOL,
  MIN_ENTRY_FEE,
  validatePrizePool,
  parsePrizeAmount,
  prizeDistributionTotal,
  validatePrizeDistribution,
  resolvePrizeTotal,
  validateEntryFee,
  validateDateWindow,
  isRegistrationClosed,
  isCompetitionStarted,
  validateCapacityEdit,
  resolveCoOrganizers,
  generateJoinCode,
} from '../src/common/validation/competition.rules';
import {
  roundRobinFixtures,
  eliminationPairings,
  computeStandings,
  iplPlayoffFixtures,
  findScheduleConflicts,
  scheduleFixtures,
} from '../src/common/tournament/tournament.utils';
import { CompetitionsService } from '../src/modules/competitions/competitions.service';
import { CompetitionsController } from '../src/modules/competitions/competitions.controller';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';
import { TeamsService } from '../src/modules/teams/teams.service';
import { TeamsController } from '../src/modules/teams/teams.controller';
import { MatchesService } from '../src/modules/matches/matches.service';
import { buildBracket } from '../src/common/tournament/bracket';
import { MatchesController } from '../src/modules/matches/matches.controller';
import { RateLimiterMiddleware } from '../src/common/middleware/rate-limiter.middleware';
import { UserRole } from '../src/common/interfaces';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed += 1;
    failures.push(`${name}: ${err?.message || err}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err?.message || err}`);
  }
}

function expectThrow(fn: () => Promise<any>, type: any, messagePart?: string) {
  return fn().then(
    () => { throw new Error('Expected the operation to throw, but it resolved.'); },
    (err) => {
      assert.ok(err instanceof type, `Expected ${type.name}, got ${err?.constructor?.name}: ${err?.message}`);
      if (messagePart) assert.ok(String(err.message).toLowerCase().includes(messagePart.toLowerCase()), `Expected message to include "${messagePart}", got "${err.message}"`);
    },
  );
}

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const noopAudit = { record: async () => undefined };
const notifications = { create: async () => undefined };

// ─── HTTP middleware regressions ───────────────────────────────────────────
async function middlewareTests() {
  console.log('\nHTTP middleware');

  await test('rate limits are isolated by method and endpoint', () => {
    const limiter = new RateLimiterMiddleware();
    const response = () => ({ setHeader: () => undefined }) as any;
    const next = () => undefined;

    // Exhaust GET /competitions for this IP.
    for (let i = 0; i < 100; i += 1) {
      limiter.use({
        ip: '127.0.0.1', method: 'GET', originalUrl: '/competitions',
        socket: {},
      } as any, response(), next);
    }
    assert.throws(() => limiter.use({
      ip: '127.0.0.1', method: 'GET', originalUrl: '/competitions',
      socket: {},
    } as any, response(), next), /Rate limit exceeded/i);

    // An unrelated POST action must retain its own allowance.
    assert.doesNotThrow(() => limiter.use({
      ip: '127.0.0.1', method: 'POST', originalUrl: '/teams',
      socket: {},
    } as any, response(), next));
  });
}

// ─── Competition rules (§2.2, §3.1–§3.4) ─────────────────────────────────────
async function competitionRuleTests() {
  console.log('\nCompetition rules');

  await test('prize pool cap is ₹10,00,000', () => {
    assert.equal(MAX_PRIZE_POOL, 1_000_000);
    assert.equal(validatePrizePool(1_000_000), null);
    assert.match(String(validatePrizePool(1_000_001)), /cannot exceed/i);
    assert.match(String(validatePrizePool(-1)), /negative/i);
    assert.match(String(validatePrizePool('abc')), /valid number/i);
  });

  await test('prize distribution totals are parsed, summed and capped', () => {
    assert.equal(parsePrizeAmount('₹1,00,000'), 100_000);
    assert.equal(parsePrizeAmount('1,00,000'), 100_000);
    assert.equal(parsePrizeAmount('No Prize Pool'), 0);
    assert.equal(Number.isNaN(parsePrizeAmount('abc')), true);

    const distribution = [{ amount: '₹5,00,000' }, { amount: '₹3,00,000' }, { amount: '₹2,00,000' }];
    assert.equal(prizeDistributionTotal(distribution), 1_000_000);
    assert.equal(validatePrizeDistribution(distribution), null);

    const tooLarge = [...distribution, { amount: 1 }];
    assert.match(String(validatePrizeDistribution(tooLarge)), /cannot exceed/i);
    assert.match(String(validatePrizeDistribution([{ amount: 'abc' }])), /valid number/i);
    assert.match(String(validatePrizeDistribution([{ amount: -1 }])), /negative/i);

    // The largest interpretation wins, so a small `prize` cannot hide a large distribution.
    assert.equal(resolvePrizeTotal({ prize: 100, prizes: [{ amount: '₹9,00,000' }] }), 900_000);
  });

  await test('entry fee minimum is ₹10 where a fee applies', () => {
    assert.equal(MIN_ENTRY_FEE, 10);
    assert.equal(validateEntryFee('free', 0), null);
    assert.equal(validateEntryFee('per_player', 10), null);
    assert.match(String(validateEntryFee('per_player', 9)), /at least ₹10/i);
    assert.match(String(validateEntryFee('per_team', 5)), /at least ₹10/i);
  });

  await test('registration window and competition dates are validated separately', () => {
    const start = new Date('2026-02-10T10:00:00Z');
    const end = new Date('2026-02-20T10:00:00Z');
    const regCloseBeforeStart = new Date('2026-02-01T10:00:00Z');

    // registration closing before the competition starts is legitimate
    assert.deepEqual(validateDateWindow({
      registrationOpenAt: new Date('2026-01-01T10:00:00Z'),
      registrationCloseAt: regCloseBeforeStart,
      startDate: start,
      endDate: end,
    }), []);

    // end before start is rejected
    assert.match(validateDateWindow({ startDate: end, endDate: start }).map((e) => e.message).join(' '), /End Date must be strictly after/i);

    // registration close before open is rejected
    assert.match(validateDateWindow({
      registrationOpenAt: new Date('2026-02-01T10:00:00Z'),
      registrationCloseAt: new Date('2026-01-01T10:00:00Z'),
    }).map((e) => e.message).join(' '), /Registration Close/i);
  });

  await test('registration closure does not count as competition start', () => {
    const comp = { registrationCloseAt: past, startDate: future };
    assert.equal(isRegistrationClosed(comp), true);
    assert.equal(isCompetitionStarted(comp), false);
  });

  await test('capacity may not decrease below current values or existing rosters', () => {
    assert.equal(validateCapacityEdit({ maxTeams: 8, maxPlayersPerTeam: 4 }, { maxTeams: 8, maxPlayersPerTeam: 4 }, 3, 3).length, 0);
    assert.match(validateCapacityEdit({ maxTeams: 8, maxPlayersPerTeam: 4 }, { maxTeams: 4 }, 2, 2).map((e) => e.message).join(' '), /cannot be decreased/i);
    assert.match(validateCapacityEdit({ maxTeams: 8, maxPlayersPerTeam: 4 }, { maxPlayersPerTeam: 2 }, 2, 3).map((e) => e.message).join(' '), /cannot be decreased/i);
  });

  await test('co-organizers must exist, cannot self-assign, and duplicates are removed', () => {
    const usernames = ['alice', 'bob', 'carol'];
    const ok = resolveCoOrganizers(['bob', 'bob', 'carol'], 'alice', usernames);
    assert.deepEqual(ok.coOrganizers, ['bob', 'carol']);
    assert.equal(ok.errors.length, 0);

    const missing = resolveCoOrganizers(['ghost'], 'alice', usernames);
    assert.match(missing.errors[0].message, /does not exist/i);

    const self = resolveCoOrganizers(['alice'], 'alice', usernames);
    assert.match(self.errors[0].message, /self-assignment/i);
  });

  await test('private join codes are unique and unpredictable enough', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateJoinCode()));
    assert.equal(codes.size, 50);
    for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  });
}

// ─── Tournament fixtures/standings (§8–§10) ──────────────────────────────────
async function tournamentTests() {
  console.log('\nTournament fixtures and standings');

  await test('round robin generates every pairing exactly once', () => {
    const fixtures = roundRobinFixtures(['A', 'B', 'C', 'D']);
    assert.equal(fixtures.length, 6);
    const pairs = fixtures.map((f) => [f.team1Id, f.team2Id].sort().join('-'));
    assert.equal(new Set(pairs).size, 6);
    assert.ok(pairs.includes(['A', 'B'].sort().join('-')));
  });

  await test('round robin handles odd team counts with byes', () => {
    const fixtures = roundRobinFixtures(['A', 'B', 'C', 'D', 'E']);
    assert.equal(fixtures.length, 10); // C(5,2) — one bye per round
    fixtures.forEach((f) => assert.ok(f.team1Id && f.team2Id));
  });

  await test('elimination bracket gives byes and pairs real teams', () => {
    const five = eliminationPairings(['A', 'B', 'C', 'D', 'E']);
    assert.equal(five.roundCount, 3);
    assert.equal(five.firstRound.length, 1);
    assert.equal(five.autoAdvancers.length, 3);
    assert.deepEqual(five.firstRound[0].team1Id, 'D');
    assert.deepEqual(five.firstRound[0].team2Id, 'E');

    const four = eliminationPairings(['A', 'B', 'C', 'D']);
    assert.equal(four.firstRound.length, 2);
    assert.equal(four.autoAdvancers.length, 0);
  });

  await test('standings apply win/draw/loss points and ranking', () => {
    const rows = computeStandings(
      ['A', 'B', 'C'],
      [
        { team1Name: 'A', team2Name: 'B', winnerName: 'A' },
        { team1Name: 'A', team2Name: 'C', winnerName: 'C' },
        { team1Name: 'B', team2Name: 'C', winnerName: '' },
      ],
    );
    assert.equal(rows[0].team, 'C'); // 4 pts (win + draw)
    assert.equal(rows[0].pts, 4);
    assert.equal(rows[1].team, 'A'); // 3 pts (win)
    assert.equal(rows[1].pts, 3);
    assert.equal(rows[0].mp, 2);
    assert.equal(rows[2].team, 'B');
    assert.equal(rows[2].pts, 1); // draw
  });

  await test('IPL-style playoffs use the top four teams', () => {
    const fixtures = iplPlayoffFixtures([{ team: 'A' }, { team: 'B' }, { team: 'C' }, { team: 'D' }]);
    assert.equal(fixtures.length, 2);
    assert.equal(fixtures[0].roundLabel, 'Qualifier 1');
    assert.equal(fixtures[1].roundLabel, 'Eliminator');
    assert.deepEqual([fixtures[0].team1Id, fixtures[0].team2Id], ['A', 'B']);
    assert.deepEqual([fixtures[1].team1Id, fixtures[1].team2Id], ['C', 'D']);
  });

  await test('scheduling never double-books a team and skips byes', () => {
    const slots = scheduleFixtures(
      [{ round: 1, team1Id: 'A', team2Id: 'B' }, { round: 1, team1Id: 'A', team2Id: 'C' }, { round: 1, team1Id: null as any, team2Id: 'D' }],
      (slot) => new Date(future.getTime() + slot * 60 * 60 * 1000),
    );
    assert.equal(slots.length, 2);
    assert.notEqual(slots[0].slotIndex, slots[1].slotIndex);
  });

  await test('schedule conflicts detect overlapping teams and out-of-window times', () => {
    const existing = [{
      id: 'm1', competitionId: 'c1', team1Id: 'A', team2Id: 'B', status: 'scheduled',
      scheduledAt: new Date('2026-02-10T10:00:00Z'),
    }];
    const window = { start: new Date('2026-02-01T00:00:00Z'), end: new Date('2026-02-28T00:00:00Z') };
    const overlap = findScheduleConflicts(
      { competitionId: 'c1', team1Id: 'A', team2Id: 'C', scheduledAt: new Date('2026-02-10T10:15:00Z') },
      existing,
      window,
      60,
    );
    assert.match(overlap.join(' '), /Overlapping match/i);

    const outside = findScheduleConflicts(
      { competitionId: 'c1', team1Id: 'C', team2Id: 'D', scheduledAt: new Date('2026-03-10T10:00:00Z') },
      existing,
      window,
      60,
    );
    assert.match(outside.join(' '), /after the competition end date/i);
  });
}

// ─── CompetitionsService (§2, §3) ────────────────────────────────────────────
async function competitionServiceTests() {
  console.log('\nCompetitionsService');

  const users = [
    { id: 'u1', username: 'alice', email: 'alice@nexus.gg' },
    { id: 'u2', username: 'bob', email: 'bob@nexus.gg' },
  ];

  function makeService(comp: any, teams: any[] = [], spy: { updateCalls?: number } = null) {
    const userRepository = {
      findById: async (id: string) => users.find((u) => u.id === id) || null,
      findAll: async () => users,
      findByUsername: async (name: string) => users.find((u) => u.username === name) || null,
    };
    const competitionRepository = {
      findById: async () => comp,
      findAll: async () => [comp],
      findByStatus: async () => [comp],
      findByCreator: async () => [comp],
      findByOrganizer: async () => [comp],
      create: async (name: string, description: string, startDate: Date, endDate: Date, createdBy: string, coOrganizers: string[], extras: any) => ({
        id: 'c1', name, description, startDate, endDate, createdBy,
        organizers: [createdBy, ...coOrganizers], ...extras,
      }),
      update: async (_id: string, updates: any) => {
        if (spy) spy.updateCalls = (spy.updateCalls || 0) + 1;
        Object.assign(comp, updates);
        return comp;
      },
    };
    const teamRepository = { find: async () => teams };
    return new CompetitionsService(
      competitionRepository as any,
      userRepository as any,
      teamRepository as any,
      notifications as any,
      noopAudit as any,
    );
  }

  const validDto: any = {
    name: 'Winter Clash',
    description: 'A competitive winter tournament for esports teams.',
    startDate: future.toISOString(),
    endDate: new Date(future.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'league',
    game: 'Valorant',
  };

  await test('competitions can be created without any identity verification', async () => {
    const service = makeService(null);
    const comp: any = await service.createCompetition(validDto, 'bob', 'u2');
    assert.equal(comp.createdBy, 'bob');
    assert.equal(comp.approvalStatus, 'approved');
  });

  await test('valid co-organizer usernames are accepted and notified', async () => {
    const service = makeService(null);
    const comp: any = await service.createCompetition({ ...validDto, coOrganizers: ['bob'] }, 'alice', 'u1');
    assert.deepEqual(comp.organizers, ['alice', 'bob']);
    assert.equal(comp.approvalStatus, 'approved');
  });

  await test('non-existent co-organizer is rejected before anything is published', async () => {
    const service = makeService(null);
    await expectThrow(() => service.createCompetition({ ...validDto, coOrganizers: ['ghost'] }, 'alice', 'u1'), BadRequestException, 'does not exist');
  });

  await test('prize pool above ₹10 lakh and negative values are rejected', async () => {
    const service = makeService(null);
    await expectThrow(() => service.createCompetition({ ...validDto, prize: 1_000_001 }, 'alice', 'u1'), BadRequestException, 'cannot exceed');
    await expectThrow(() => service.createCompetition({ ...validDto, prize: -50 }, 'alice', 'u1'), BadRequestException, 'negative');
  });

  await test('backend rejects a distribution above the cap even when prize is small', async () => {
    const service = makeService(null);
    await expectThrow(
      () => service.createCompetition({
        ...validDto,
        prize: 1_000,
        prizes: [{ place: '1st Place', amount: '₹9,00,000' }, { place: '2nd Place', amount: '₹2,00,000' }],
      }, 'alice', 'u1'),
      BadRequestException,
      'cannot exceed',
    );
  });

  await test('backend accepts a distribution totalling exactly ₹10,00,000', async () => {
    const service = makeService(null);
    const comp: any = await service.createCompetition({
      ...validDto,
      prizes: [{ place: '1st Place', amount: '₹5,00,000' }, { place: '2nd Place', amount: '₹5,00,000' }],
    }, 'alice', 'u1');
    assert.equal(comp.prize, 1_000_000);
  });

  await test('backend rejects malformed prize distribution entries', async () => {
    const service = makeService(null);
    await expectThrow(
      () => service.createCompetition({ ...validDto, prizes: [{ amount: 'not-a-number' }] }, 'alice', 'u1'),
      BadRequestException,
      'valid number',
    );
  });

  await test('prize pool above ₹50,000 is auto-approved without admin approval', async () => {
    const service = makeService(null);
    const comp: any = await service.createCompetition({ ...validDto, prize: 60_000 }, 'alice', 'u1');
    assert.equal(comp.prize, 60_000);
    assert.equal(comp.approvalStatus, 'approved');
  });

  await test('private competitions get a join code; public competitions do not', async () => {
    const service = makeService(null);
    const priv: any = await service.createCompetition({ ...validDto, visibility: 'private' }, 'alice', 'u1');
    assert.equal(priv.visibility, 'private');
    assert.ok(priv.joinCode && priv.joinCode.length >= 8);
    const pub: any = await service.createCompetition({ ...validDto, visibility: 'public' }, 'alice', 'u1');
    assert.equal(pub.joinCode, null);
  });

  await test('public detail endpoint never exposes the join code', async () => {
    const service = makeService({ id: 'c1', name: 'Private Cup', visibility: 'private', joinCode: 'SECRET42' });
    const comp: any = await service.getCompetitionById('c1');
    assert.equal(comp.joinCode, undefined);
  });

  await test('competition lists never expose the join code', async () => {
    const service = makeService({ id: 'c1', name: 'Private Cup', visibility: 'private', joinCode: 'SECRET42' });
    const lists = await Promise.all([
      service.getAllCompetitions(),
      service.getActiveCompetitions(),
      service.getCompetitionsByUser('alice'),
      service.getCompetitionsByOrganizer('alice'),
    ]);
    lists.forEach((list: any[]) => {
      assert.equal(list.length, 1);
      assert.equal(list[0].joinCode, undefined);
      assert.equal(list[0].visibility, 'private');
    });
  });

  await test('joining enforces private join codes without any identity verification', async () => {
    const service = makeService({ id: 'c1', name: 'Private Cup', visibility: 'private', joinCode: 'SECRET42' });
    await expectThrow(() => service.participate('c1', 'WRONG', { id: 'u1', username: 'alice' }), BadRequestException, 'Invalid join code');
    const ok = await service.participate('c1', 'SECRET42', { id: 'u2', username: 'bob' });
    assert.equal(ok.ok, true);
  });

  await test('competition banners persist and can be removed by the organizer only', async () => {
    const comp: any = {id:'c1',name:'Cup',createdBy:'alice',organizers:['alice'],status:'upcoming',startDate:future,endDate:new Date(+future+86400000)};
    const service = makeService(comp);
    const img = 'data:image/png;base64,iVBORw0KGgo=';
    await service.updateCompetition('c1',{img},'alice','team_lead');
    assert.equal(comp.img,img);
    await expectThrow(() => service.updateCompetition('c1',{img:''},'bob','participant'), ForbiddenException);
    await expectThrow(() => service.updateCompetition('c1',{img:'data:text/html;base64,abcd'},'alice','team_lead'), BadRequestException, 'PNG or JPEG');
    assert.equal(comp.img,img);
    await service.updateCompetition('c1',{img:''},'alice','team_lead');
    assert.equal(comp.img,'');
  });

  await test('registration-closed competitions lock name/game/type/description', async () => {
    const comp = {
      id: 'c1', name: 'Locked Cup', description: 'Original description', game: 'Valorant', type: 'league',
      createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
      prize: 5000, feeType: 'free', registrationCloseAt: past, startDate: future,
      endDate: new Date(future.getTime() + 86_400_000),
    };
    const service = makeService(comp);
    await expectThrow(() => service.updateCompetition('c1', { name: 'Renamed Cup' } as any, 'alice', 'team_lead'), BadRequestException, 'Registration has closed');
  });

  await test('prize pool and obsolete fields cannot be modified through edit', async () => {
    const comp: any = {
      id: 'c1', name: 'Cup', description: 'Original description', game: 'Valorant', type: 'league',
      createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
      prize: 5000, feeType: 'free', startDate: future, endDate: new Date(future.getTime() + 86_400_000),
    };
    const service = makeService(comp);
    await expectThrow(() => service.updateCompetition('c1', { prize: 9000 } as any, 'alice', 'team_lead'), BadRequestException, 'prize pool cannot be modified');
    await expectThrow(() => service.updateCompetition('c1', { format: 'Round Robin' } as any, 'alice', 'team_lead'), BadRequestException, 'no longer editable');
  });

  await test('capacity cannot be decreased below registered teams/rosters', async () => {
    const comp: any = {
      id: 'c1', name: 'Cup', description: 'Original description', game: 'Valorant', type: 'league',
      createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
      prize: 5000, feeType: 'free', startDate: future, endDate: new Date(future.getTime() + 86_400_000),
    };
    const teams = [
      { id: 't1', status: 'approved', memberUsernames: ['a', 'b', 'c'] },
      { id: 't2', status: 'approved', memberUsernames: ['d'] },
      { id: 't3', status: 'approved', memberUsernames: ['e'] },
    ];
    const service = makeService(comp, teams);
    await expectThrow(() => service.updateCompetition('c1', { maxTeams: 2 } as any, 'alice', 'team_lead'), BadRequestException, 'cannot be decreased');
    await expectThrow(() => service.updateCompetition('c1', { maxPlayersPerTeam: 2 } as any, 'alice', 'team_lead'), BadRequestException, 'cannot be decreased');
  });

  await test('end date earlier than start date is rejected on edit', async () => {
    const comp: any = {
      id: 'c1', name: 'Cup', description: 'Original description', game: 'Valorant', type: 'league',
      createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
      prize: 5000, feeType: 'free', startDate: future, endDate: new Date(future.getTime() + 86_400_000),
    };
    const service = makeService(comp);
    await expectThrow(
      () => service.updateCompetition('c1', { endDate: new Date(future.getTime() - 86_400_000).toISOString() } as any, 'alice', 'team_lead'),
      BadRequestException,
      'End Date must be strictly after',
    );
  });

  await test('competition creation and owner-management endpoints have no role restriction', () => {
    const ownerEndpoints = [
      'createCompetition',
      'updateCompetition',
      'addCoOrganizer',
      'removeCoOrganizer',
      'getJoinCode',
      'getParticipants',
    ];
    for (const endpoint of ownerEndpoints) {
      const roles = Reflect.getMetadata(ROLES_KEY, CompetitionsController.prototype[endpoint]);
      assert.equal(roles, undefined, `${endpoint} must not require a privileged role`);
    }

    // Administrative operations remain role-protected.
    const approvalRoles = Reflect.getMetadata(ROLES_KEY, CompetitionsController.prototype.setApproval);
    assert.ok(Array.isArray(approvalRoles) && approvalRoles.includes('admin'));
    const deleteRoles = Reflect.getMetadata(ROLES_KEY, CompetitionsController.prototype.deleteCompetition);
    assert.deepEqual(deleteRoles, ['super_admin']);
  });

  function editableComp(overrides: any = {}) {
    return {
      id: 'c1',
      name: 'Editable Cup',
      description: 'Original description',
      game: 'Valorant',
      type: 'league',
      status: 'upcoming',
      createdBy: 'alice',
      organizers: ['alice', 'bob'],
      maxTeams: 8,
      maxPlayersPerTeam: 4,
      prize: 5000,
      feeType: 'free',
      startDate: future,
      endDate: new Date(future.getTime() + 86_400_000),
      registrationCloseAt: new Date(future.getTime() + 86_400_000),
      ...overrides,
    };
  }

  await test('edit rejects a nonexistent co-organizer and writes nothing', async () => {
    const comp: any = editableComp();
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    await expectThrow(
      () => service.updateCompetition('c1', { coOrganizers: ['bob', 'randomuser123'] } as any, 'alice', 'team_lead'),
      BadRequestException,
      'randomuser123',
    );
    assert.equal(spy.updateCalls, 0, 'no partial update may occur');
    assert.deepEqual(comp.organizers, ['alice', 'bob'], 'existing co-organizers must be preserved');
  });

  await test('edit validates multiple co-organizers together before updating', async () => {
    const comp: any = editableComp();
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    await expectThrow(
      () => service.updateCompetition('c1', { coOrganizers: ['bob', 'ghost1', 'ghost2'] } as any, 'alice', 'team_lead'),
      BadRequestException,
      'ghost1',
    );
    assert.equal(spy.updateCalls, 0);
  });

  await test('edit saves valid co-organizers and deduplicates them', async () => {
    const comp: any = editableComp();
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    const updated: any = await service.updateCompetition(
      'c1',
      { coOrganizers: ['bob', '@bob'] } as any,
      'alice',
      'team_lead',
    );
    assert.deepEqual(updated.organizers, ['alice', 'bob']);
    assert.equal(spy.updateCalls, 1);
  });

  await test('edit rejects self-assignment and preserves existing organizers', async () => {
    const comp: any = editableComp();
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    await expectThrow(
      () => service.updateCompetition('c1', { coOrganizers: ['alice'] } as any, 'alice', 'team_lead'),
      BadRequestException,
      'self-assignment',
    );
    assert.equal(spy.updateCalls, 0);
    assert.deepEqual(comp.organizers, ['alice', 'bob']);
  });

  await test('edit preserves co-organizers when the field is omitted, and can clear them', async () => {
    const comp: any = editableComp();
    const service = makeService(comp, [], { updateCalls: 0 });
    await service.updateCompetition('c1', { name: 'Renamed Cup' } as any, 'alice', 'team_lead');
    assert.deepEqual(comp.organizers, ['alice', 'bob']);
    await service.updateCompetition('c1', { coOrganizers: [] } as any, 'alice', 'team_lead');
    assert.deepEqual(comp.organizers, ['alice']);
  });

  await test('edit saves remaining fields: name, game, type, description and status', async () => {
    const comp: any = editableComp();
    const service = makeService(comp, [], { updateCalls: 0 });
    await service.updateCompetition('c1', {
      name: 'Updated Cup',
      game: 'Dota 2',
      type: 'tournament',
      description: 'Updated description',
      status: 'ongoing',
    } as any, 'alice', 'team_lead');
    assert.equal(comp.name, 'Updated Cup');
    assert.equal(comp.game, 'Dota 2');
    assert.equal(comp.type, 'tournament');
    assert.equal(comp.description, 'Updated description');
    assert.equal(comp.status, 'ongoing');
  });

  await test('competition cannot be ended before its persisted start time', async () => {
    const comp: any = editableComp({ startDate: future, status: 'upcoming' });
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    await expectThrow(
      () => service.endCompetition('c1', 'alice', 'team_lead'),
      BadRequestException,
      'only after the tournament has started',
    );
    assert.equal(spy.updateCalls, 0);
    assert.equal(comp.status, 'upcoming');
  });

  await test('competition with a missing or invalid start date cannot be ended', async () => {
    for (const startDate of [null, 'not-a-date']) {
      const comp: any = editableComp({ startDate, status: 'upcoming' });
      const spy = { updateCalls: 0 };
      const service = makeService(comp, [], spy);
      await expectThrow(
        () => service.endCompetition('c1', 'alice', 'team_lead'),
        BadRequestException,
        'only after the tournament has started',
      );
      assert.equal(spy.updateCalls, 0);
    }
  });

  await test('a started competition can be ended by its organizer', async () => {
    const comp: any = editableComp({ startDate: past, status: 'ongoing' });
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    const updated: any = await service.endCompetition('c1', 'alice', 'team_lead');
    assert.equal(updated.status, 'completed');
    assert.equal(spy.updateCalls, 1);
  });

  await test('an already ended competition cannot be ended repeatedly', async () => {
    const comp: any = editableComp({ startDate: past, status: 'completed' });
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    await expectThrow(
      () => service.endCompetition('c1', 'alice', 'team_lead'),
      BadRequestException,
      'already ended',
    );
    assert.equal(spy.updateCalls, 0);
  });

  await test('an unrelated user cannot end someone else\'s competition', async () => {
    const comp: any = editableComp({ startDate: past, status: 'ongoing' });
    const spy = { updateCalls: 0 };
    const service = makeService(comp, [], spy);
    await expectThrow(
      () => service.endCompetition('c1', 'mallory', 'participant'),
      ForbiddenException,
      'Only an organizer',
    );
    assert.equal(spy.updateCalls, 0);
  });

  await test('participant contacts expose real emails only through the organizer path', async () => {
    const comp: any = { id: 'c1', createdBy: 'alice', organizers: ['alice'], name: 'Cup' };
    const teams = [{ id: 't1', name: 'Alpha', status: 'approved', leaderUsername: 'bob', memberUsernames: ['bob'] }];
    const service = makeService(comp, teams);
    const contacts = await service.getParticipantContacts('c1', 'alice', 'team_lead');
    assert.equal(contacts[0].email, 'bob@nexus.gg');
    assert.equal(contacts[0].role, 'team_lead');
    await expectThrow(() => service.getParticipantContacts('c1', 'bob', 'participant'), ForbiddenException, 'organizers');
  });
}

// ─── TeamsService (§4–§6) ───────────────────────────────────────────────────
async function teamServiceTests() {
  console.log('\nTeamsService');

  function makeService(opts: {
    competition?: any;
    team?: any;
    userState?: string;
    userRole?: string;
    paidMembers?: string[];
    existingRefund?: any;
    teams?: any[];
    matchesService?: any;
  } = {}) {
    const competition = opts.competition || {
      id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'],
      visibility: 'public', maxTeams: 8, maxPlayersPerTeam: 3,
      startDate: future, endDate: new Date(future.getTime() + 86_400_000), entryFeeAmount: 0,
    };
    const team = opts.team || {
      id: 't1', name: 'Alpha', competitionId: 'c1', leaderId: 'alice', createdBy: 'alice',
      leaderUsername: 'alice', memberUsernames: ['alice', 'bob'], status: 'approved',
    };
    const saved: any[] = [];
    const mutations: any[] = [];
    const invites: any[] = [];
    const joinRequest: any = { id: 'req-1', teamId: 't1', competitionId: 'c1', fromUsername: 'carol', status: 'pending' };
    const userRepository = {
      findById: async () => ({
        id: 'u1', username: 'alice',
        role: opts.userRole || UserRole.PARTICIPANT,
      }),
      findByUsername: async (name: string) => (name === 'ghost' ? null : ({
        id: `u-${name}`, username: name, email: `${name}@nexus.gg`,
        role: name === 'boss' ? UserRole.ADMIN : UserRole.PARTICIPANT,
      })),
      findAll: async () => [
        { id: 'u1', username: 'alice', role: UserRole.TEAM_LEAD },
        { id: 'u2', username: 'bob', role: UserRole.PARTICIPANT },
        { id: 'u3', username: 'carol', role: UserRole.PARTICIPANT },
        { id: 'u4', username: 'dave', role: UserRole.TEAM_LEAD },
        { id: 'u5', username: 'erin', role: UserRole.PARTICIPANT, banned: true },
        { id: 'u6', username: 'boss', role: UserRole.ADMIN },
        { id: 'u7', username: 'organizer', role: UserRole.PARTICIPANT },
      ],
      update: async (_id: string, updates: any) => {
        mutations.push({ op: 'update-user', ...updates });
        return { id: 'u1', username: 'alice', ...updates };
      },
    };
    const teamRepository = {
      findById: async () => team,
      findByCompetition: async () => opts.teams || [team],
      find: async () => opts.teams || [team],
      create: async (name: string, competitionId: string, leaderId: string, members: string[], status: string) => {
        mutations.push({ op: 'create', name, competitionId, leaderId, members, status });
        return { ...team, id: 't-new', name, leaderId, memberUsernames: [leaderId, ...members], status };
      },
      update: async (_id: string, updates: any) => { Object.assign(team, updates); return team; },
      addMember: async (_id: string, member: string) => { team.memberUsernames.push(member); return team; },
      removeMember: async (_id: string, member: string) => { team.memberUsernames = team.memberUsernames.filter((m: string) => m !== member); return team; },
      getInvitesByTeam: async () => invites,
      findJoinRequestById: async () => joinRequest,
      getJoinRequestsByTeam: async () => [],
      hasPaidJoinRequest: async () => joinRequest.status === 'paid',
      updateJoinRequest: async (_id: string, status: string) => { mutations.push({ op: 'join-request', status }); joinRequest.status = status; return { ...joinRequest }; },
      getInvitesByUser: async (name: string) => invites.filter((i) => i.toUsername === name),
      findInviteById: async (id: string) => invites.find((i) => i.id === id) || null,
      createInvite: async (teamId: string, competitionId: string, toUsername: string, fromUsername: string) => {
        const invite = { id: `inv-${invites.length + 1}`, teamId, competitionId, toUsername, fromUsername, status: 'pending' };
        invites.push(invite);
        return invite;
      },
      updateInvite: async (id: string, status: string) => {
        const invite = invites.find((i) => i.id === id);
        invite.status = status;
        return invite;
      },
      setStatus: async (_id: string, status: string) => { mutations.push({ op: 'setStatus', status }); return { ...team, status }; },
    };
    const competitionRepository = { findById: async () => competition };
    const refundRepo = {
      findOne: async () => opts.existingRefund || null,
      create: (data: any) => ({ id: 'refund-1', ...data }),
      save: async (data: any) => { saved.push(data); return data; },
    };
    const paid = new Set(opts.paidMembers || []);
    const revenueRepo = { exists: async ({ where }: any) => paid.has(where.organizerName) };
    const service = new TeamsService(
      teamRepository as any,
      competitionRepository as any,
      userRepository as any,
      notifications as any,
      noopAudit as any,
      refundRepo as any,
      revenueRepo as any,
      opts.matchesService as any,
    );
    return { service, team, competition, saved, mutations, invites, joinRequest };
  }

  await test('teams can be created without any identity verification', async () => {
    const { service, mutations } = makeService();
    await service.createTeam({ name: 'Bravo', competitionId: 'c1' } as any, { id: 'u1', username: 'alice' });
    assert.ok(mutations.find((m) => m.op === 'create'));
  });

  await test('new teams are auto-approved on creation', async () => {
    const { service, mutations } = makeService();
    await service.createTeam({ name: 'Bravo', competitionId: 'c1' } as any, { id: 'u1', username: 'alice', role: 'team_lead' });
    const created = mutations.find((m) => m.op === 'create');
    assert.ok(created);
    assert.equal(created.status, 'approved');
  });

  await test('a new registration automatically validates and rebuilds an existing bracket', async () => {
    const calls: string[] = [];
    const matchesService = {
      assertRosterCanChange: async (id: string) => calls.push(`guard:${id}`),
      syncRosterAfterRegistration: async (id: string) => { calls.push(`sync:${id}`); return { rebuilt: true, created: 7 }; },
    };
    const { service } = makeService({ matchesService });
    await service.createTeam({ name: 'Bravo', competitionId: 'c1' } as any, { id: 'u1', username: 'alice' });
    assert.deepEqual(calls, ['guard:c1', 'sync:c1']);
  });

  await test('team registration is rejected before its write when bracket play has started', async () => {
    const matchesService = { assertRosterCanChange: async () => { throw new BadRequestException('bracket has already started'); } };
    const { service, mutations } = makeService({ matchesService });
    await expectThrow(() => service.createTeam({ name: 'Bravo', competitionId: 'c1' } as any, { id: 'u1', username: 'alice' }), BadRequestException, 'already started');
    assert.equal(mutations.some((mutation) => mutation.op === 'create'), false);
  });

  await test('participants may create a team and are promoted to team lead', async () => {
    const createRoles = Reflect.getMetadata(ROLES_KEY, TeamsController.prototype.createTeam);
    assert.ok(createRoles.includes(UserRole.PARTICIPANT));

    const { service, mutations } = makeService({ userRole: UserRole.PARTICIPANT });
    await service.createTeam(
      { name: 'Bravo', competitionId: 'c1' } as any,
      { id: 'u1', username: 'alice', role: UserRole.PARTICIPANT },
    );
    const promotion = mutations.find((m) => m.op === 'update-user');
    assert.equal(promotion?.role, UserRole.TEAM_LEAD);
  });

  await test('private competitions require the correct join code for team creation', async () => {
    const competition = {
      id: 'c1', name: 'Private Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'private', joinCode: 'SECRET42',
      maxTeams: 8, maxPlayersPerTeam: 3, startDate: future, endDate: new Date(future.getTime() + 86_400_000),
    };
    const { service } = makeService({ competition });
    await expectThrow(() => service.createTeam({ name: 'Bravo', competitionId: 'c1' } as any, { id: 'u1', username: 'alice' }), BadRequestException, 'Invalid join code');
    const team = await service.createTeam({ name: 'Bravo', competitionId: 'c1', joinCode: 'SECRET42' } as any, { id: 'u1', username: 'alice' });
    assert.ok(team);
  });

  await test('team capacity is enforced on member addition', async () => {
    const team = {
      id: 't1', name: 'Alpha', competitionId: 'c1', leaderId: 'alice', createdBy: 'alice',
      leaderUsername: 'alice', memberUsernames: ['alice', 'bob', 'carol'], status: 'approved',
    };
    const { service } = makeService({ team });
    await expectThrow(() => service.addMember('t1', { memberId: 'dave' } as any, { username: 'alice' }), BadRequestException, 'Team is full');
  });

  await test('join requests cannot be approved once the competition has started', async () => {
    const competition = {
      id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'public',
      maxTeams: 8, maxPlayersPerTeam: 5, startDate: past, endDate: new Date(future.getTime() + 86_400_000),
    };
    const { service, team, mutations } = makeService({ competition });
    await expectThrow(() => service.updateJoinRequest('req-1', 'approved', { id: 'u1', username: 'alice' }), ForbiddenException, 'rosters are locked');
    assert.ok(!team.memberUsernames.includes('carol'));
    assert.ok(!mutations.some((m: any) => m.op === 'join-request'));
  });

  const paidCompetition = () => ({
    id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'public',
    maxTeams: 8, maxPlayersPerTeam: 5, startDate: future, endDate: new Date(future.getTime() + 86_400_000),
    feeType: 'per_player', entryFeeAmount: 100,
  });
  const alice = { id: 'u1', username: 'alice' };
  const carolPlayer = { id: 'u3', username: 'carol' };

  await test('where players pay: lead accepts first, and paying is what joins the team', async () => {
    const { service, team, joinRequest } = makeService({ competition: paidCompetition() });
    await expectThrow(() => service.payJoinRequest('req-1', carolPlayer), BadRequestException, 'accept your request before');
    const accepted: any = await service.updateJoinRequest('req-1', 'accepted', alice);
    assert.equal(accepted.status, 'awaiting_payment');
    assert.equal(accepted.amount, 100);
    assert.ok(!team.memberUsernames.includes('carol'));
    await expectThrow(() => service.payJoinRequest('req-1', { id: 'u4', username: 'dave' }), ForbiddenException, 'not assigned');
    const paid: any = await service.payJoinRequest('req-1', carolPlayer);
    assert.equal(paid.status, 'paid');
    assert.ok(team.memberUsernames.includes('carol'));
    assert.equal(joinRequest.status, 'paid');
    await expectThrow(() => service.payJoinRequest('req-1', carolPlayer), BadRequestException, 'already been paid');
    await expectThrow(() => service.removeMember('t1', 'carol', 'Repeated no-shows', alice), ForbiddenException, 'has paid');
  });

  await test('where the fee is not per player, accepting joins the team straight away', async () => {
    const { service, team } = makeService();
    const accepted: any = await service.updateJoinRequest('req-1', 'accepted', alice);
    assert.equal(accepted.status, 'approved');
    assert.ok(team.memberUsernames.includes('carol'));
  });

  await test('fees cannot be paid once the competition has started', async () => {
    const { service, team, joinRequest } = makeService({ competition: { ...paidCompetition(), startDate: past } });
    joinRequest.status = 'awaiting_payment';
    await expectThrow(() => service.payJoinRequest('req-1', carolPlayer), ForbiddenException, 'rosters are locked');
    assert.ok(!team.memberUsernames.includes('carol'));
  });

  await test('removed members and former captains cannot edit through historical ownership', async () => {
    const { service, team } = makeService();
    await expectThrow(() => service.updateTeam('t1',{name:'Changed'},{username:'bob'}), ForbiddenException);
    team.memberUsernames = ['bob'];
    await expectThrow(() => service.updateTeam('t1',{name:'Changed'},{username:'alice'}), ForbiddenException);
    team.leaderId = 'bob';
    await expectThrow(() => service.updateTeam('t1',{name:'Changed'},{username:'alice'}), ForbiddenException);
    team.status = 'banned';
    await expectThrow(() => service.updateTeam('t1',{name:'Changed'},{username:'bob'}), ForbiddenException);
    assert.equal(team.name,'Alpha');
  });

  await test('a removed player is told the reason', async () => {
    const sent: any[] = [];
    const original = notifications.create;
    notifications.create = (async (data: any) => { sent.push(data); }) as any;
    try {
      const { service } = makeService();
      await service.removeMember('t1', 'bob', 'Repeated no-shows', { username: 'alice' });
      const notice = sent.find((n) => n.type === 'team-member-removed');
      assert.equal(notice.toUsername, 'bob');
      assert.equal(notice.status, 'rejected');
      assert.ok(notice.body.includes('Reason: Repeated no-shows'));
      assert.equal(notice.meta.reason, 'Repeated no-shows');
    } finally {
      notifications.create = original;
    }
  });

  await test('removal requires a reason and blocks paid participants', async () => {
    const { service } = makeService({ paidMembers: ['bob'] });
    await expectThrow(
      () => service.removeMember('t1', 'bob', 'no', { username: 'alice' }),
      BadRequestException,
      'meaningful removal reason',
    );
    await expectThrow(
      () => service.removeMember('t1', 'bob', 'Repeated no-shows', { username: 'alice' }),
      ForbiddenException,
      'has paid the participation fee',
    );
  });

  await test('removal is blocked once the competition has started', async () => {
    const competition = {
      id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'public',
      maxTeams: 8, maxPlayersPerTeam: 3, startDate: past, endDate: new Date(future.getTime() + 86_400_000),
    };
    const { service } = makeService({ competition });
    await expectThrow(() => service.removeMember('t1', 'bob', 'Repeated no-shows', { username: 'alice' }), ForbiddenException, 'competition has started');
    await expectThrow(() => service.addMember('t1', { memberId: 'carol' } as any, { username: 'alice' }), ForbiddenException, 'competition has started');
  });

  await test('disband requires a meaningful reason and is blocked after start', async () => {
    const started = {
      id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'public',
      maxTeams: 8, maxPlayersPerTeam: 3, startDate: past, endDate: new Date(future.getTime() + 86_400_000),
    };
    const notStarted = { ...started, startDate: future };
    const startedService = makeService({ competition: started }).service;
    const service = makeService({ competition: notStarted }).service;
    await expectThrow(() => service.disbandTeam('t1', 'short', { username: 'alice' }), BadRequestException, 'meaningful disband reason');
    await expectThrow(() => startedService.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' }), ForbiddenException, 'not allowed after the competition has started');
  });

  await test('disband notifies members with the reason; the client roster never drives refunds', async () => {
    const sent: any[] = [];
    const original = notifications.create;
    notifications.create = (async (data: any) => { sent.push(data); }) as any;
    try {
      const { service, saved } = makeService({ paidMembers: ['bob', 'carol'] });
      await service.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' }, ['carol', 'ALICE', 'BOB']);
      const toMembers = sent.filter((n) => n.title.includes('Your Team'));
      assert.deepEqual(toMembers.map((n) => n.toUsername).sort(), ['bob', 'carol']);
      assert.ok(toMembers.every((n) => n.body.includes('Reason: Team is inactive and cannot continue')));
      assert.deepEqual(saved.map((r) => r.username), ['bob']);
    } finally {
      notifications.create = original;
    }
  });

  const lead = { id: 'u1', username: 'alice' };
  const carol = { id: 'u3', username: 'carol' };

  await test('available players come from the backend and exclude teammates, admins and banned users', async () => {
    const { service } = makeService();
    const all = await service.getAvailablePlayers('t1', '', lead);
    assert.deepEqual(all.map((p: any) => p.username), ['carol', 'dave']);
    assert.ok(all.every((p: any) => !('email' in p)));
    const searched = await service.getAvailablePlayers('t1', 'CAR', lead);
    assert.deepEqual(searched.map((p: any) => p.username), ['carol']);
    await service.createInvite('t1', 'c1', 'carol', 'alice', lead);
    const after = await service.getAvailablePlayers('t1', '', lead);
    assert.deepEqual(after.map((p: any) => [p.username, p.invited]), [['carol', true], ['dave', false]]);
    await expectThrow(() => service.getAvailablePlayers('t1', '', carol), ForbiddenException, '');
  });

  await test('only the team lead can invite, and only valid targets', async () => {
    const { service } = makeService();
    await expectThrow(() => service.createInvite('t1', 'c1', 'dave', 'carol', carol), ForbiddenException, '');
    await expectThrow(() => service.createInvite('t1', 'c1', 'ghost', 'alice', lead), BadRequestException, 'User not found');
    await expectThrow(() => service.createInvite('t1', 'c1', 'boss', 'alice', lead), BadRequestException, 'regular users');
    await expectThrow(() => service.createInvite('t1', 'c1', 'bob', 'alice', lead), BadRequestException, 'already in this team');
    await service.createInvite('t1', 'c1', 'carol', 'alice', lead);
    await expectThrow(() => service.createInvite('t1', 'c1', 'carol', 'alice', lead), BadRequestException, 'Pending invite');
  });

  await test('players on another team in the competition cannot be invited or accept', async () => {
    const other = { id: 't2', name: 'Bravo', competitionId: 'c1', leaderId: 'dave', memberUsernames: ['dave', 'carol'], status: 'approved' };
    const team = { id: 't1', name: 'Alpha', competitionId: 'c1', leaderId: 'alice', createdBy: 'alice', leaderUsername: 'alice', memberUsernames: ['alice', 'bob'], status: 'approved' };
    const { service, invites } = makeService({ team, teams: [team, other] });
    await expectThrow(() => service.createInvite('t1', 'c1', 'carol', 'alice', lead), BadRequestException, 'another team');
    invites.push({ id: 'inv-9', teamId: 't1', competitionId: 'c1', toUsername: 'carol', fromUsername: 'alice', status: 'pending' });
    await expectThrow(() => service.updateInvite('inv-9', 'accepted', carol), BadRequestException, 'another team');
  });

  await test('invites can only be answered by the invitee, once', async () => {
    const { service, team } = makeService();
    const invite = await service.createInvite('t1', 'c1', 'carol', 'alice', lead);
    await expectThrow(() => service.updateInvite(invite.id, 'accepted', { id: 'u4', username: 'dave' }), ForbiddenException, 'not assigned');
    await expectThrow(() => service.updateInvite(invite.id, 'maybe', carol), BadRequestException, 'accepted or declined');
    const accepted = await service.updateInvite(invite.id, 'accepted', carol);
    assert.equal(accepted.status, 'accepted');
    assert.ok(team.memberUsernames.includes('carol'));
    assert.ok(accepted.team.memberUsernames.includes('carol'));
    await expectThrow(() => service.updateInvite(invite.id, 'declined', carol), BadRequestException, 'already handled');
  });

  await test('revoked invites disappear for the lead and cannot be accepted', async () => {
    const { service, team } = makeService();
    const invite = await service.createInvite('t1', 'c1', 'carol', 'alice', lead);
    await expectThrow(() => service.revokeInvite('t1', invite.id, carol), ForbiddenException, '');
    await service.revokeInvite('t1', invite.id, lead);
    assert.equal((await service.getInvitesByTeam('t1', lead)).length, 0);
    await expectThrow(() => service.updateInvite(invite.id, 'accepted', carol), BadRequestException, 'revoked');
    assert.ok(!team.memberUsernames.includes('carol'));
  });

  await test('users can only read their own invitations', async () => {
    const { service } = makeService();
    assert.deepEqual(await service.getInvitesByUser('carol', carol), []);
    await expectThrow(() => service.getInvitesByUser('carol', { id: 'u4', username: 'dave' }), ForbiddenException, 'another user');
  });

  await test('disband records a pending refund for paid participants exactly once', async () => {
    const { service, saved } = makeService({ paidMembers: ['bob'] });
    const result = await service.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].status, 'pending');
    assert.equal(saved[0].username, 'bob');
    assert.equal(result.refunds[0].status, 'pending');

    // idempotency: an existing refund for the same key is reused, never duplicated
    const existing = makeService({
      paidMembers: ['bob'],
      existingRefund: { id: 'refund-existing', refundKey: 'disband:t1:bob', username: 'bob', amount: 100, status: 'pending' },
    });
    const again = await existing.service.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' });
    assert.equal(existing.saved.length, 0);
    assert.equal(again.refunds[0].status, 'pending');
  });
}

// ─── MatchesService (§8.3, §10, §11) ────────────────────────────────────────
async function matchServiceTests() {
  console.log('\nMatchesService');

  function makeService(opts: { competition?: any; matches?: any[]; teams?: any[] } = {}) {
    const competition = opts.competition || {
      id: 'c1', name: 'Cup', type: 'league', format: 'Round Robin', status: 'active',
      createdBy: 'organizer', organizers: ['organizer'],
      startDate: new Date('2026-02-01T00:00:00Z'), endDate: new Date('2026-02-28T00:00:00Z'),
    };
    const matches = opts.matches || [];
    const teams = opts.teams || [
      { id: 'tA', name: 'A', leaderId: 'a', memberUsernames: ['a'], status: 'approved' },
      { id: 'tB', name: 'B', leaderId: 'b', memberUsernames: ['b'], status: 'approved' },
      { id: 'tC', name: 'C', leaderId: 'c', memberUsernames: ['c'], status: 'approved' },
      { id: 'tD', name: 'D', leaderId: 'd', memberUsernames: ['d'], status: 'approved' },
    ];
    let counter = matches.length;
    const repo = {
      create: (data: any) => ({ id: `m${++counter}`, ...data }),
      save: async (match: any) => {
        const idx = matches.findIndex((m) => m.id === match.id);
        if (idx >= 0) matches[idx] = match; else matches.push(match);
        return match;
      },
      find: async ({ where }: any = {}) => matches.filter((m) => Object.entries(where || {}).every(([k, v]) => m[k] === v)),
      findOne: async ({ where }: any) => matches.find((m) => m.id === where.id) || null,
      update: async (id: string, updates: any) => {
        const match = matches.find((m) => m.id === id);
        if (match) Object.assign(match, updates);
        return match;
      },
      count: async ({ where }: any = {}) => matches.filter((m) => Object.entries(where || {}).every(([k, v]) => m[k] === v)).length,
      delete: async (target: any) => {
        if (typeof target === 'string') {
          const index = matches.findIndex((m) => m.id === target);
          if (index >= 0) matches.splice(index, 1);
        } else if (target?.competitionId) {
          for (let i = matches.length - 1; i >= 0; i--) if (matches[i].competitionId === target.competitionId) matches.splice(i, 1);
        }
      },
    };
    const competitionRepository = {
      findById: async () => competition,
      update: async (_id: string, updates: any) => { Object.assign(competition, updates); return competition; },
    };
    const teamRepository = {
      findById: async (id: string) => teams.find((t) => t.id === id) || null,
      findByCompetition: async () => teams,
    };
    return {
      service: new MatchesService(repo as any, competitionRepository as any, teamRepository as any, notifications as any, noopAudit as any),
      matches,
      competition,
      repo,
    };
  }

  await test('IPL playoffs advance the Q1 loser, freeze standings and finish only at the Final', async () => {
    for (const first of ['Qualifier 1', 'Eliminator']) {
      const {service, matches, competition} = makeService();
      await service.generateSchedule('c1', 'organizer');
      const league = [...matches];
      const finish = (m: any) => service.recordResult(m.id, m.team1Id, m.team1Name, '20-15', 'organizer');
      for (const m of league.slice(0, -1)) await finish(m);
      assert.equal(matches.filter(m => m.bracket?.kind === 'ipl').length, 0);
      await finish(league[league.length - 1]);
      const standings = await service.getStandings('c1');
      const stage = (label: string) => matches.find(m => m.round === label);
      const q1 = stage('Qualifier 1'), e = stage('Eliminator'), q2 = stage('Qualifier 2'), final = stage('Final');
      assert.deepEqual([q1.team1Name,q1.team2Name,e.team1Name,e.team2Name], standings.slice(0,4).map(r => r.team));
      assert.equal(q2.status, 'pending'); assert.equal(q2.scheduledAt, null);
      assert.equal(q2.team1Name, 'Loser of Qualifier 1');
      await expectThrow(() => service.recordResult(q2.id, '', '', '20-15', 'organizer'), BadRequestException, 'Both participating');
      await expectThrow(() => service.updateSchedule(q2.id, {scheduledAt: new Date('2026-02-20')}, 'organizer'), BadRequestException, 'prerequisites');
      await expectThrow(() => service.recordResult(q1.id, '', '', '20-20', 'organizer'), BadRequestException, 'require a winner');
      await finish(stage(first));
      assert.equal(q2.status, 'pending'); assert.equal(final.status, 'pending');
      await finish(stage(first === 'Qualifier 1' ? 'Eliminator' : 'Qualifier 1'));
      assert.equal(q2.team1Id, q1.team2Id); assert.equal(q2.team2Id, e.winnerId);
      assert.equal(q2.status, 'ready'); assert.ok(q2.scheduledAt);
      assert.equal(final.team1Id, q1.winnerId); assert.equal(final.status, 'pending');
      assert.equal(competition.status, 'active');
      await finish(q2);
      assert.equal(final.team2Id, q2.winnerId); assert.equal(final.status, 'ready');
      await finish(final);
      assert.equal(competition.status, 'completed');
      assert.deepEqual(await service.getStandings('c1'), standings);
      const ids = matches.map(m => m.id).sort();
      await service.findByCompetition('c1'); await service.syncPlayoffs('c1');
      assert.deepEqual(matches.map(m => m.id).sort(), ids);
      assert.equal(matches.length, league.length + 4);
      const scheduled = matches.filter(m => m.scheduledAt).sort((a,b) => +a.scheduledAt - +b.scheduledAt);
      for (let i=1; i<scheduled.length; i++) assert.ok(+new Date(scheduled[i].scheduledAt) >= +new Date(scheduled[i-1].scheduledAt) + scheduled[i-1].durationMinutes * 60000);
    }
  });

  await test('legacy name-only playoff fixtures are repaired without duplicates', async () => {
    const {service, matches} = makeService();
    await service.generateSchedule('c1', 'organizer');
    for (const m of matches) Object.assign(m, {status:'completed', winnerId:m.team1Id, winnerName:m.team1Name, score:'20-15'});
    matches.push({id:'legacy-q1',competitionId:'c1',round:'Qualifier 1',team1Name:'A',team2Name:'B',status:'scheduled'});
    matches.push({id:'duplicate-q1',competitionId:'c1',round:'Qualifier 1',team1Name:'A',team2Name:'B',status:'scheduled'});
    await service.findByCompetition('c1');
    assert.equal(matches.filter(m => m.round === 'Qualifier 1').length, 1);
    const q1 = matches.find(m => m.round === 'Qualifier 1');
    assert.ok(q1.team1Id && q1.team2Id);
    await service.recordResult(q1.id,q1.team1Id,q1.team1Name,'20-15','organizer');
    assert.equal(q1.status,'completed');
    assert.equal(matches.filter(m => m.bracket?.kind === 'ipl').length, 4);
  });

  await test('complete brackets contain B-1 positions, separate top seeds, and award byes for 2 through 64 teams', () => {
    for (let count = 2; count <= 64; count++) {
      const teams = Array.from({ length: count }, (_, i) => `t${i}`);
      const nodes = buildBracket(teams);
      const size = 2 ** Math.ceil(Math.log2(count));
      assert.equal(nodes.length, size - 1);
      const opening = nodes.filter((node) => node.roundIndex === 1);
      const byes = opening.filter((node) => node.sides.some((side) => side.bye));
      assert.equal(byes.length, size - count);
      assert.deepEqual(byes.map((node) => node.sides.find((side) => side.teamId).seed).sort((a,b) => a-b), Array.from({length: size-count}, (_,i) => i+1));
      const seedOne = opening.find((node) => node.sides.some((side) => side.seed === 1));
      const seedTwo = opening.find((node) => node.sides.some((side) => side.seed === 2));
      if (size > 2) assert.ok(seedOne.position <= size/4 && seedTwo.position > size/4);
      const destinations = new Set();
      for (const node of nodes) {
        if (!node.destination) { assert.equal(node.roundIndex, Math.log2(size)); continue; }
        const target = nodes.find((item) => item.key === node.destination.key);
        assert.equal(target.roundIndex, node.roundIndex + 1);
        assert.equal(target.sides[node.destination.slot-1].source, node.key);
        assert.ok(!destinations.has(`${target.key}:${node.destination.slot}`));
        destinations.add(`${target.key}:${node.destination.slot}`);
      }
      assert.deepEqual(nodes.flatMap((node) => node.sides.map((side) => side.teamId)).filter(Boolean).sort(), teams.sort());
      const available = new Set<string>();
      for (const node of nodes) {
        node.sides.forEach((side) => { if (side.source) assert.ok(available.has(side.source)); });
        available.add(node.key);
      }
      assert.equal(nodes.at(-1).round, 'Final');
    }
  });

  await test('five-team legacy bracket is completed without replacing its match or schedule', async () => {
    const teams = ['A', 'B', 'C', 'D', 'E'].map((name) => ({ id: `t${name}`, name, status: 'approved' }));
    const first = { id: 'legacy', competitionId: 'c1', team1Id: 'tD', team2Id: 'tE', team1Name: 'D', team2Name: 'E', round: 'Quarterfinal', status: 'scheduled', scheduledAt: new Date('2026-02-10T10:00:00Z') };
    const competition = { id: 'c1', name: 'Cup', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const { service, matches } = makeService({ teams, matches: [first], competition });
    const result = await service.completeBracket('c1', 'organizer');
    assert.equal(result.created, 6);
    assert.equal(matches.length, 7);
    assert.equal(+new Date(matches.find((m) => m.id === 'legacy').scheduledAt), +first.scheduledAt);
    assert.equal(matches.filter((m) => m.round === 'Semifinal').length, 2);
    assert.equal(matches.filter((m) => m.status === 'bye').length, 3);
    matches.filter((m) => m.status === 'bye').forEach((m) => { assert.equal(m.scheduledAt, null); assert.equal(m.score, null); assert.ok(m.winnerId); });
    const ids = matches.map((m) => m.id);
    const snapshot = JSON.stringify(matches);
    assert.equal((await service.completeBracket('c1', 'organizer')).created, 0);
    assert.deepEqual(matches.map((m) => m.id), ids);
    assert.equal(JSON.stringify(matches), snapshot, 'repeat completion must preserve team orientation, feeder links, byes, and dates');
    await expectThrow(() => service.recordResult(matches.find((m) => m.round === 'Final').id, 'tA', 'A', '2-0', 'organizer'), BadRequestException, 'Both participating');
    await service.recordResult('legacy', matches.find(m => m.id === 'legacy').team1Id, matches.find(m => m.id === 'legacy').team1Name, '15-1', 'organizer');
    assert.equal(competition.status, 'active', 'quarterfinal must not end the tournament');
    const semis = matches.filter((m) => m.round === 'Semifinal');
    assert.ok(semis.some((m) => m.team2Id === 'tD'));
    for (const semi of semis) await service.recordResult(semi.id, semi.team1Id, semi.team1Name, '15-1', 'organizer');
    assert.equal(competition.status, 'active', 'semifinals must not end the tournament');
    const final = matches.find((m) => m.round === 'Final');
    assert.ok(final.team1Id && final.team2Id);
    await service.recordResult(final.id, final.team1Id, final.team1Name, '15-1', 'organizer');
    assert.equal(competition.status, 'completed');
    assert.equal(matches.length, 7, 'progression fills existing slots without creating duplicates');
  });

  await test('ambiguous legacy brackets are rejected without changing fixtures', async () => {
    const original = { id: 'old', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', round: 'Quarterfinal', status: 'scheduled' };
    const competition = { id: 'c1', type: 'tournament', format: 'Single Elimination', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const { service, matches } = makeService({ competition, matches: [original] });
    await expectThrow(() => service.completeBracket('c1', 'organizer'), BadRequestException, 'No fixtures were changed');
    assert.deepEqual(matches, [original]);
  });

  await test('rescheduling accepts serialized dates and rejects all overlaps, invalid dates, and window overflow', async () => {
    const a = { id: 'a', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', status: 'scheduled', scheduledAt: new Date('2026-02-10T10:00:00Z'), durationMinutes: 90 };
    const b = { id: 'b', competitionId: 'c1', team1Id: 'tC', team2Id: 'tD', status: 'scheduled', scheduledAt: new Date('2026-02-10T14:00:00Z'), durationMinutes: 60 };
    const { service } = makeService({ matches: [a, b] });
    await expectThrow(() => service.updateSchedule('b', { scheduledAt: '2026-02-10T11:00:00Z' as any }, 'organizer'), BadRequestException, 'Overlapping match');
    await expectThrow(() => service.updateSchedule('b', { scheduledAt: 'invalid' as any }, 'organizer'), BadRequestException, 'valid match date');
    await expectThrow(() => service.updateSchedule('b', { scheduledAt: '2026-02-27T23:30:00Z' as any }, 'organizer'), BadRequestException, 'finish before');
    const saved = await service.updateSchedule('b', { scheduledAt: '2026-02-10T11:30:00Z' as any }, 'organizer');
    assert.equal(new Date(saved.scheduledAt).toISOString(), '2026-02-10T11:30:00.000Z');
  });

  await test('a feeder match cannot move after its dependent round even without an overlap', async () => {
    const first = { id: 'first', competitionId: 'c1', status: 'scheduled', scheduledAt: new Date('2026-02-10T10:00:00Z'), bracket: { key: 'r1-m1' } };
    const final = { id: 'final', competitionId: 'c1', status: 'scheduled', scheduledAt: new Date('2026-02-10T12:00:00Z'), bracket: { key: 'r2-m1', source1: 'first' } };
    const { service } = makeService({ matches: [first, final] });
    await expectThrow(() => service.updateSchedule('first', { scheduledAt: new Date('2026-02-11T10:00:00Z') }, 'organizer'), BadRequestException, 'finish before the next');
    await expectThrow(() => service.updateSchedule('final', { scheduledAt: new Date('2026-02-09T10:00:00Z') }, 'organizer'), BadRequestException, 'after its feeder');
  });

  await test('organizers with participant roles can edit their matches; unrelated users cannot', async () => {
    const { service } = makeService({ matches: [{ id: 'm', competitionId: 'c1', status: 'scheduled' }] });
    const controller = new MatchesController(service);
    assert.equal(Reflect.getMetadata(ROLES_KEY, MatchesController.prototype.recordResult), undefined);
    assert.equal(Reflect.getMetadata(ROLES_KEY, MatchesController.prototype.update), undefined);
    await service.assertOrganizer('c1', 'organizer', 'participant');
    await expectThrow(() => controller.update('m', { scheduledAt: '2026-02-10T10:00:00Z' }, { user: { username: 'stranger', role: 'team_lead' } }), ForbiddenException, 'Only an organizer');
  });

  await test('completed draws are immutable and a winner must agree with the score', async () => {
    const draw = { id: 'draw', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B', status: 'completed', score: '1-1' };
    const pending = { ...draw, id: 'pending', status: 'scheduled' };
    const { service } = makeService({ matches: [draw, pending] });
    await expectThrow(() => service.recordResult('draw', '', '', '2-2', 'organizer'), BadRequestException, 'Duplicate submissions');
    await expectThrow(() => service.updateSchedule('draw', { scheduledAt: new Date('2026-02-10') }, 'organizer'), ForbiddenException, 'cannot be modified');
    await expectThrow(() => service.recordResult('pending', 'tA', 'A', '0-2', 'organizer'), BadRequestException, 'Winner must match');
    await expectThrow(() => service.recordResult('pending', 'tA', 'A', '-1-0', 'organizer'), BadRequestException, 'non-negative');
  });

  await test('manual scheduling rejects out-of-window and overlapping matches', async () => {
    const existing = [{
      id: 'm0', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
      status: 'scheduled', scheduledAt: new Date('2026-02-10T10:00:00Z'),
    }];
    const { service } = makeService({ matches: existing });
    await expectThrow(
      () => service.create({ competitionId: 'c1', team1Id: 'tC', team2Id: 'tD', scheduledAt: new Date('2026-03-10T10:00:00Z') }),
      BadRequestException,
      'after the competition end date',
    );
    await expectThrow(
      () => service.create({ competitionId: 'c1', team1Id: 'tA', team2Id: 'tC', scheduledAt: new Date('2026-02-10T10:15:00Z') }),
      BadRequestException,
      'Overlapping match',
    );
  });

  await test('verified results cannot be submitted twice or changed by scheduling', async () => {
    const match = {
      id: 'm1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
      status: 'completed', winnerId: 'tA', winnerName: 'A', score: '2-0', round: 'Round 1',
    };
    const { service } = makeService({ matches: [match] });
    await expectThrow(() => service.recordResult('m1', 'tA', 'A', '2-0', 'organizer'), BadRequestException, 'Duplicate submissions');
    await expectThrow(() => service.updateSchedule('m1', { scheduledAt: new Date('2026-02-12T10:00:00Z') }, 'organizer'), ForbiddenException, 'cannot be modified');
  });

  await test('only a participating team can be declared winner', async () => {
    const match = {
      id: 'm1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
      status: 'scheduled', round: 'Round 1',
    };
    const { service } = makeService({ matches: [match] });
    await expectThrow(() => service.recordResult('m1', 'tC', 'C', '2-0', 'organizer'), BadRequestException, 'participating team');
    await expectThrow(() => service.recordResult('m1', 'tA', 'A', '', 'organizer'), BadRequestException, 'score is required');
  });

  await test('league draws are accepted, knockout draws are rejected', async () => {
    const leagueMatch = { id: 'm1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B', status: 'scheduled', round: 'Round 1' };
    const league = makeService({ matches: [leagueMatch] });
    await league.service.recordResult('m1', '', '', '1-1', 'organizer');
    assert.equal(leagueMatch.status, 'completed');
    assert.equal(leagueMatch.winnerId, null);

    const knockoutMatch = { id: 'm2', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B', status: 'scheduled', round: 'Round 1' };
    const knockoutCompetition = {
      id: 'c1', name: 'Knockout', type: 'tournament', format: 'Single Elimination', status: 'active',
      startDate: new Date('2026-02-01T00:00:00Z'), endDate: new Date('2026-02-28T00:00:00Z'),
    };
    const knockout = makeService({ competition: knockoutCompetition, matches: [knockoutMatch] });
    await expectThrow(() => knockout.service.recordResult('m2', '', '', '1-1', 'organizer'), BadRequestException, 'require a winner');
  });

  await test('16 and 14 team tournaments persist every destination, wait for both teams, and crown only the final winner', async () => {
    for (const count of [3, 14, 16, 17]) {
      const teams = Array.from({ length: count }, (_, i) => ({ id: `t${i+1}`, name: `Team ${i+1}`, status: 'approved' }));
      const competition = { id: 'c1', name: 'Tournament', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
      const { service, matches } = makeService({ teams, competition });
      await service.generateSchedule('c1', 'organizer');
      const size = 2 ** Math.ceil(Math.log2(count));
      assert.equal(matches.length, size-1);
      assert.equal(matches.filter((m) => m.status === 'bye').length, size-count);
      if (count === 16 || count === 14) assert.deepEqual([1,2,3,4].map((round) => matches.filter((m) => m.bracket.round === round).length), [8,4,2,1]);
      const pending = matches.find((m) => m.status === 'pending');
      await expectThrow(() => service.recordResult(pending.id, '', '', '10-0', 'organizer'), BadRequestException, 'Both participating');
      let played = 0;
      while (matches.some((m) => m.status === 'ready')) {
        const current = matches.find((m) => m.status === 'ready');
        const strongerSide = current.bracket.slots[0].seed < current.bracket.slots[1].seed ? 1 : 2;
        const round = { team1: strongerSide === 1 ? 10 : 0, team2: strongerSide === 2 ? 10 : 0 };
        await service.recordResult(current.id, current[`team${strongerSide}Id`], current[`team${strongerSide}Name`], `${round.team1}-${round.team2}`, 'organizer');
        played++;
        if (current.bracket.nextMatchId) {
          const target = matches.find((m) => m.id === current.bracket.nextMatchId);
          assert.equal(target.bracket.slots[current.bracket.nextSlot-1].teamId, current.winnerId);
          assert.equal(target.status, target.team1Id && target.team2Id ? 'ready' : 'pending');
          assert.equal(competition.status, 'active');
        }
      }
      assert.equal(played, count-1);
      assert.equal(matches.length, size-1);
      const final = matches.find((m) => !m.bracket.nextMatchId);
      assert.equal(final.winnerId, 't1');
      assert.deepEqual([final.team1Id,final.team2Id].sort(), ['t1','t2']);
      assert.equal(competition.status, 'completed');
    }
  });

  await test('a 20-15 final score completes an existing match without question rounds', async () => {
    const competition = { id: 'c1', name: 'Tournament', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const { service, matches } = makeService({ competition, teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    await service.completeBracket('c1', 'organizer');
    const match = matches[0];
    match.resultRule = 'obsolete-scoring-rule';
    await service.recordResult(match.id, match.team1Id, match.team1Name, '20-15', 'organizer');
    assert.equal(match.score, '20-15');
    assert.equal(match.status, 'completed');
    assert.equal(match.winnerId, match.team1Id);
    assert.equal(match.resultDetails, null);
    assert.equal(competition.status, 'completed');
  });

  await test('single final scores support legacy fixtures and host-decided knockout ties', async () => {
    const competition = { id: 'c1', name: 'Tournament', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const {service, matches} = makeService({competition, teams: [{id:'a', name:'A'}, {id:'b',name:'B'}]});
    await service.completeBracket('c1','organizer');
    const match = matches[0];
    match.resultRule = 'obsolete-scoring-rule';
    await expectThrow(() => service.recordResult(match.id, 'b', 'B', '10-0', 'organizer'), BadRequestException, 'Winner must match');
    await expectThrow(() => service.recordResult(match.id, 'other', 'B', '10-10', 'organizer'), BadRequestException, 'participating team');
    await service.recordResult(match.id, 'b', 'B', '10-10', 'organizer');
    assert.equal(match.winnerId, 'b');
    assert.equal(match.score, '10-10');
    assert.equal(match.resultRule, 'standard');
    assert.equal(match.resultDetails.rounds, undefined);
    assert.equal(match.resultDetails.hostWinnerId, 'b');
    assert.equal(matches.length, 1, 'a tied match never adds another question or fixture');
    assert.equal(competition.status, 'completed');
  });

  await test('custom seeding must be a permutation, persists on reload, and locks after play starts', async () => {
    const competition = { id: 'c1', name: 'Tournament', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const {service, matches} = makeService({competition});
    await expectThrow(() => service.completeBracket('c1','organizer','',['tA','tA','tC','tD']), BadRequestException, 'exactly once');
    const seeds=['tD','tC','tB','tA'];
    await service.completeBracket('c1','organizer','',seeds);
    const first = matches.find((m) => m.bracket.round===1 && m.bracket.position===1);
    assert.equal(first.team1Id,'tD'); assert.equal(first.team2Id,'tA');
    await service.completeBracket('c1','organizer');
    assert.equal(matches.find((m)=>m.id===first.id).team1Id,'tD');
    await service.recordResult(first.id,first.team1Id,first.team1Name,'3-0','organizer');
    await expectThrow(() => service.completeBracket('c1','organizer','',['tA','tB','tC','tD']), BadRequestException, 'cannot be reseeded');
  });

  await test('registering another team spontaneously expands an unstarted bracket and appends its seed', async () => {
    const teams = ['A', 'B', 'C', 'D'].map((name) => ({ id: `t${name}`, name, status: 'approved' }));
    const competition = { id: 'c1', name: 'Cup', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const { service, matches } = makeService({ teams, competition });
    await service.completeBracket('c1', 'organizer', '', ['tC', 'tA', 'tD', 'tB']);
    teams.push({ id: 'tE', name: 'E', status: 'approved' });
    const result = await service.syncRosterAfterRegistration('c1');
    assert.equal(result.rebuilt, true);
    assert.equal(matches.length, 7);
    const seeds = matches.filter((match) => match.bracket.round === 1).flatMap((match) => match.bracket.slots)
      .filter((slot) => slot.teamId).sort((a, b) => a.seed - b.seed).map((slot) => slot.teamId);
    assert.deepEqual(seeds, ['tC', 'tA', 'tD', 'tB', 'tE']);
    assert.equal(matches.filter((match) => match.status === 'bye').length, 3);
    assert.equal(matches.filter((match) => match.status !== 'bye').length, 4);
  });

  await test('roster sync is inert before a bracket exists and rejects a started bracket', async () => {
    const competition = { id: 'c1', name: 'Cup', type: 'tournament', format: 'Single Elimination', status: 'active', createdBy: 'organizer', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28') };
    const empty = makeService({ competition });
    assert.deepEqual(await empty.service.syncRosterAfterRegistration('c1'), { rebuilt: false, created: 0 });
    const started = makeService({ competition, matches: [{ id: 'm1', competitionId: 'c1', status: 'completed' }] });
    await expectThrow(() => started.service.syncRosterAfterRegistration('c1'), BadRequestException, 'already started');
  });

  await test('schedule regeneration never touches completed results and avoids duplicates', async () => {
    const completed = {
      id: 'done', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
      status: 'completed', winnerId: 'tA', winnerName: 'A', score: '2-0', round: 'Round 1',
    };
    const { service, matches } = makeService({ matches: [completed] });
    const result = await service.generateSchedule('c1', 'organizer', {});
    assert.ok(result.created > 0);
    assert.equal(matches.filter((m) => m.id === 'done').length, 1);
    assert.equal(matches.filter((m) => m.status === 'completed').length, 1);
    const pairs = matches
      .filter((m) => m.team1Name && m.team2Name)
      .map((m) => [m.team1Name, m.team2Name].sort().join('-'));
    assert.equal(new Set(pairs).size, pairs.length);
    matches.filter((m) => m.id !== 'done').forEach((m) => {
      assert.match(m.team1Id, /^t[A-D]$/);
      assert.match(m.team2Id, /^t[A-D]$/);
      assert.ok(m.team1Name && m.team2Name);
    });
  });

  await test('only the competition organizer or an admin can generate fixtures', async () => {
    const { service } = makeService();
    await expectThrow(
      () => service.generateSchedule('c1', 'unrelated-user', {}, UserRole.PARTICIPANT),
      ForbiddenException,
      'Only an organizer',
    );
    const adminResult = await service.generateSchedule('c1', 'competition-admin', {}, UserRole.COMP_ADMIN);
    assert.ok(adminResult.created > 0);
  });

  await test('regeneration with scheduled fixtures requires explicit confirmation', async () => {
    const scheduled = {
      id: 's1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
      status: 'scheduled', round: 'Round 1',
    };
    const { service } = makeService({ matches: [scheduled] });
    await expectThrow(() => service.generateSchedule('c1', 'organizer', {}), BadRequestException, 'confirmOverlap=true');
  });
}

async function main() {
  console.log('NEXUS ESPORTS — workflow test suite');
  await competitionRuleTests();
  await middlewareTests();
  await tournamentTests();
  await competitionServiceTests();
  await teamServiceTests();
  await matchServiceTests();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(` - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
