"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const assert = require("node:assert/strict");
const common_1 = require("@nestjs/common");
const competition_rules_1 = require("../src/common/validation/competition.rules");
const tournament_utils_1 = require("../src/common/tournament/tournament.utils");
const verification_service_1 = require("../src/modules/verification/verification.service");
const competitions_service_1 = require("../src/modules/competitions/competitions.service");
const teams_service_1 = require("../src/modules/teams/teams.service");
const matches_service_1 = require("../src/modules/matches/matches.service");
let passed = 0;
let failed = 0;
const failures = [];
async function test(name, fn) {
    try {
        await fn();
        passed += 1;
        console.log(`  PASS  ${name}`);
    }
    catch (err) {
        failed += 1;
        failures.push(`${name}: ${err?.message || err}`);
        console.log(`  FAIL  ${name}`);
        console.log(`        ${err?.message || err}`);
    }
}
function expectThrow(fn, type, messagePart) {
    return fn().then(() => { throw new Error('Expected the operation to throw, but it resolved.'); }, (err) => {
        assert.ok(err instanceof type, `Expected ${type.name}, got ${err?.constructor?.name}: ${err?.message}`);
        if (messagePart)
            assert.ok(String(err.message).toLowerCase().includes(messagePart.toLowerCase()), `Expected message to include "${messagePart}", got "${err.message}"`);
    });
}
const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const noopAudit = { record: async () => undefined };
const notifications = { create: async () => undefined };
async function competitionRuleTests() {
    console.log('\nCompetition rules');
    await test('prize pool cap is ₹10,00,000', () => {
        assert.equal(competition_rules_1.MAX_PRIZE_POOL, 1_000_000);
        assert.equal((0, competition_rules_1.validatePrizePool)(1_000_000), null);
        assert.match(String((0, competition_rules_1.validatePrizePool)(1_000_001)), /cannot exceed/i);
        assert.match(String((0, competition_rules_1.validatePrizePool)(-1)), /negative/i);
        assert.match(String((0, competition_rules_1.validatePrizePool)('abc')), /valid number/i);
    });
    await test('entry fee minimum is ₹10 where a fee applies', () => {
        assert.equal(competition_rules_1.MIN_ENTRY_FEE, 10);
        assert.equal((0, competition_rules_1.validateEntryFee)('free', 0), null);
        assert.equal((0, competition_rules_1.validateEntryFee)('per_player', 10), null);
        assert.match(String((0, competition_rules_1.validateEntryFee)('per_player', 9)), /at least ₹10/i);
        assert.match(String((0, competition_rules_1.validateEntryFee)('per_team', 5)), /at least ₹10/i);
    });
    await test('registration window and competition dates are validated separately', () => {
        const start = new Date('2026-02-10T10:00:00Z');
        const end = new Date('2026-02-20T10:00:00Z');
        const regCloseBeforeStart = new Date('2026-02-01T10:00:00Z');
        assert.deepEqual((0, competition_rules_1.validateDateWindow)({
            registrationOpenAt: new Date('2026-01-01T10:00:00Z'),
            registrationCloseAt: regCloseBeforeStart,
            startDate: start,
            endDate: end,
        }), []);
        assert.match((0, competition_rules_1.validateDateWindow)({ startDate: end, endDate: start }).map((e) => e.message).join(' '), /End Date must be strictly after/i);
        assert.match((0, competition_rules_1.validateDateWindow)({
            registrationOpenAt: new Date('2026-02-01T10:00:00Z'),
            registrationCloseAt: new Date('2026-01-01T10:00:00Z'),
        }).map((e) => e.message).join(' '), /Registration Close/i);
    });
    await test('registration closure does not count as competition start', () => {
        const comp = { registrationCloseAt: past, startDate: future };
        assert.equal((0, competition_rules_1.isRegistrationClosed)(comp), true);
        assert.equal((0, competition_rules_1.isCompetitionStarted)(comp), false);
    });
    await test('capacity may not decrease below current values or existing rosters', () => {
        assert.equal((0, competition_rules_1.validateCapacityEdit)({ maxTeams: 8, maxPlayersPerTeam: 4 }, { maxTeams: 8, maxPlayersPerTeam: 4 }, 3, 3).length, 0);
        assert.match((0, competition_rules_1.validateCapacityEdit)({ maxTeams: 8, maxPlayersPerTeam: 4 }, { maxTeams: 4 }, 2, 2).map((e) => e.message).join(' '), /cannot be decreased/i);
        assert.match((0, competition_rules_1.validateCapacityEdit)({ maxTeams: 8, maxPlayersPerTeam: 4 }, { maxPlayersPerTeam: 2 }, 2, 3).map((e) => e.message).join(' '), /cannot be decreased/i);
    });
    await test('co-organizers must exist, cannot self-assign, and duplicates are removed', () => {
        const usernames = ['alice', 'bob', 'carol'];
        const ok = (0, competition_rules_1.resolveCoOrganizers)(['bob', 'bob', 'carol'], 'alice', usernames);
        assert.deepEqual(ok.coOrganizers, ['bob', 'carol']);
        assert.equal(ok.errors.length, 0);
        const missing = (0, competition_rules_1.resolveCoOrganizers)(['ghost'], 'alice', usernames);
        assert.match(missing.errors[0].message, /does not exist/i);
        const self = (0, competition_rules_1.resolveCoOrganizers)(['alice'], 'alice', usernames);
        assert.match(self.errors[0].message, /self-assignment/i);
    });
    await test('private join codes are unique and unpredictable enough', () => {
        const codes = new Set(Array.from({ length: 50 }, () => (0, competition_rules_1.generateJoinCode)()));
        assert.equal(codes.size, 50);
        for (const code of codes)
            assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    });
}
async function tournamentTests() {
    console.log('\nTournament fixtures and standings');
    await test('round robin generates every pairing exactly once', () => {
        const fixtures = (0, tournament_utils_1.roundRobinFixtures)(['A', 'B', 'C', 'D']);
        assert.equal(fixtures.length, 6);
        const pairs = fixtures.map((f) => [f.team1Id, f.team2Id].sort().join('-'));
        assert.equal(new Set(pairs).size, 6);
        assert.ok(pairs.includes(['A', 'B'].sort().join('-')));
    });
    await test('round robin handles odd team counts with byes', () => {
        const fixtures = (0, tournament_utils_1.roundRobinFixtures)(['A', 'B', 'C', 'D', 'E']);
        assert.equal(fixtures.length, 10);
        fixtures.forEach((f) => assert.ok(f.team1Id && f.team2Id));
    });
    await test('elimination bracket gives byes and pairs real teams', () => {
        const five = (0, tournament_utils_1.eliminationPairings)(['A', 'B', 'C', 'D', 'E']);
        assert.equal(five.roundCount, 3);
        assert.equal(five.firstRound.length, 1);
        assert.equal(five.autoAdvancers.length, 3);
        assert.deepEqual(five.firstRound[0].team1Id, 'D');
        assert.deepEqual(five.firstRound[0].team2Id, 'E');
        const four = (0, tournament_utils_1.eliminationPairings)(['A', 'B', 'C', 'D']);
        assert.equal(four.firstRound.length, 2);
        assert.equal(four.autoAdvancers.length, 0);
    });
    await test('standings apply win/draw/loss points and ranking', () => {
        const rows = (0, tournament_utils_1.computeStandings)(['A', 'B', 'C'], [
            { team1Name: 'A', team2Name: 'B', winnerName: 'A' },
            { team1Name: 'A', team2Name: 'C', winnerName: 'C' },
            { team1Name: 'B', team2Name: 'C', winnerName: '' },
        ]);
        assert.equal(rows[0].team, 'C');
        assert.equal(rows[0].pts, 4);
        assert.equal(rows[1].team, 'A');
        assert.equal(rows[1].pts, 3);
        assert.equal(rows[0].mp, 2);
        assert.equal(rows[2].team, 'B');
        assert.equal(rows[2].pts, 1);
    });
    await test('IPL-style playoffs use the top four teams', () => {
        const fixtures = (0, tournament_utils_1.iplPlayoffFixtures)([{ team: 'A' }, { team: 'B' }, { team: 'C' }, { team: 'D' }]);
        assert.equal(fixtures.length, 2);
        assert.equal(fixtures[0].roundLabel, 'Qualifier 1');
        assert.equal(fixtures[1].roundLabel, 'Eliminator');
        assert.deepEqual([fixtures[0].team1Id, fixtures[0].team2Id], ['A', 'B']);
        assert.deepEqual([fixtures[1].team1Id, fixtures[1].team2Id], ['C', 'D']);
    });
    await test('scheduling never double-books a team and skips byes', () => {
        const slots = (0, tournament_utils_1.scheduleFixtures)([{ round: 1, team1Id: 'A', team2Id: 'B' }, { round: 1, team1Id: 'A', team2Id: 'C' }, { round: 1, team1Id: null, team2Id: 'D' }], (slot) => new Date(future.getTime() + slot * 60 * 60 * 1000));
        assert.equal(slots.length, 2);
        assert.notEqual(slots[0].slotIndex, slots[1].slotIndex);
    });
    await test('schedule conflicts detect overlapping teams and out-of-window times', () => {
        const existing = [{
                id: 'm1', competitionId: 'c1', team1Id: 'A', team2Id: 'B', status: 'scheduled',
                scheduledAt: new Date('2026-02-10T10:00:00Z'),
            }];
        const window = { start: new Date('2026-02-01T00:00:00Z'), end: new Date('2026-02-28T00:00:00Z') };
        const overlap = (0, tournament_utils_1.findScheduleConflicts)({ competitionId: 'c1', team1Id: 'A', team2Id: 'C', scheduledAt: new Date('2026-02-10T10:15:00Z') }, existing, window, 60);
        assert.match(overlap.join(' '), /Overlapping match/i);
        const outside = (0, tournament_utils_1.findScheduleConflicts)({ competitionId: 'c1', team1Id: 'C', team2Id: 'D', scheduledAt: new Date('2026-03-10T10:00:00Z') }, existing, window, 60);
        assert.match(outside.join(' '), /after the competition end date/i);
    });
}
async function verificationTests() {
    console.log('\nVerification (simulated)');
    function makeService() {
        const user = { id: 'u1', username: 'alice', verificationStatus: 'unverified', organizerVerificationStatus: 'unverified' };
        const updates = [];
        const userRepository = {
            findById: async () => user,
            update: async (_id, patch) => { updates.push(patch); Object.assign(user, patch); return user; },
        };
        const audit = { record: async () => undefined };
        return { service: new verification_service_1.VerificationService(userRepository, audit), user, updates };
    }
    await test('new accounts default to unverified', async () => {
        const { service } = makeService();
        const status = await service.getStatus('u1', 'alice');
        assert.equal(status.verificationStatus, 'unverified');
        assert.equal(status.simulated, true);
    });
    await test('invalid Aadhaar formats are rejected', async () => {
        const { service } = makeService();
        await expectThrow(() => service.requestOtp('u1', '1234'), common_1.BadRequestException, '12-digit');
        await expectThrow(() => service.requestOtp('u1', '12345678901a'), common_1.BadRequestException, '12-digit');
    });
    await test('12-digit formats are accepted without storing the number', async () => {
        const { service, updates } = makeService();
        const result = await service.requestOtp('u1', '1234 5678 9012');
        assert.equal(result.ok, true);
        assert.equal(result.masked, 'XXXX XXXX 9012');
        assert.equal(updates.length, 0);
    });
    await test('empty OTP is rejected and a non-empty mock OTP verifies', async () => {
        const { service, updates } = makeService();
        await expectThrow(() => service.verify('u1', ''), common_1.BadRequestException, 'OTP');
        const result = await service.verify('u1', '123456');
        assert.equal(result.verificationStatus, 'verified');
        assert.equal(updates.length, 1);
        const persisted = updates[0];
        assert.equal(persisted.verificationStatus, 'verified');
        assert.equal(Object.prototype.hasOwnProperty.call(persisted, 'aadhaarNumber'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(persisted, 'otp'), false);
    });
    await test('verified users are not asked to verify again', async () => {
        const { service, user } = makeService();
        user.verificationStatus = 'verified';
        const result = await service.verify('u1', 'anything');
        assert.equal(result.alreadyVerified, true);
    });
}
async function competitionServiceTests() {
    console.log('\nCompetitionsService');
    const users = [
        { id: 'u1', username: 'alice', email: 'alice@nexus.gg', verificationStatus: 'verified' },
        { id: 'u2', username: 'bob', email: 'bob@nexus.gg', verificationStatus: 'unverified' },
    ];
    function makeService(comp, teams = []) {
        const userRepository = {
            findById: async (id) => users.find((u) => u.id === id) || null,
            findAll: async () => users,
            findByUsername: async (name) => users.find((u) => u.username === name) || null,
        };
        const competitionRepository = {
            findById: async () => comp,
            findAll: async () => [comp],
            create: async (name, description, startDate, endDate, createdBy, coOrganizers, extras) => ({
                id: 'c1', name, description, startDate, endDate, createdBy,
                organizers: [createdBy, ...coOrganizers], ...extras,
            }),
            update: async (_id, updates) => { Object.assign(comp, updates); return comp; },
        };
        const teamRepository = { find: async () => teams };
        return new competitions_service_1.CompetitionsService(competitionRepository, userRepository, teamRepository, notifications, noopAudit);
    }
    const validDto = {
        name: 'Winter Clash',
        description: 'A competitive winter tournament for verified teams.',
        startDate: future.toISOString(),
        endDate: new Date(future.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'league',
        game: 'Valorant',
    };
    await test('unverified users cannot create competitions', async () => {
        const service = makeService(null);
        await expectThrow(() => service.createCompetition(validDto, 'bob', 'u2'), common_1.ForbiddenException, 'verification is required');
    });
    await test('valid co-organizer usernames are accepted and notified', async () => {
        const service = makeService(null);
        const comp = await service.createCompetition({ ...validDto, coOrganizers: ['bob'] }, 'alice', 'u1');
        assert.deepEqual(comp.organizers, ['alice', 'bob']);
        assert.equal(comp.approvalStatus, 'approved');
    });
    await test('non-existent co-organizer is rejected before anything is published', async () => {
        const service = makeService(null);
        await expectThrow(() => service.createCompetition({ ...validDto, coOrganizers: ['ghost'] }, 'alice', 'u1'), common_1.BadRequestException, 'does not exist');
    });
    await test('prize pool above ₹10 lakh and negative values are rejected', async () => {
        const service = makeService(null);
        await expectThrow(() => service.createCompetition({ ...validDto, prize: 1_000_001 }, 'alice', 'u1'), common_1.BadRequestException, 'cannot exceed');
        await expectThrow(() => service.createCompetition({ ...validDto, prize: -50 }, 'alice', 'u1'), common_1.BadRequestException, 'negative');
    });
    await test('prize pool above ₹50,000 is auto-approved without admin approval', async () => {
        const service = makeService(null);
        const comp = await service.createCompetition({ ...validDto, prize: 60_000 }, 'alice', 'u1');
        assert.equal(comp.prize, 60_000);
        assert.equal(comp.approvalStatus, 'approved');
    });
    await test('private competitions get a join code; public competitions do not', async () => {
        const service = makeService(null);
        const priv = await service.createCompetition({ ...validDto, visibility: 'private' }, 'alice', 'u1');
        assert.equal(priv.visibility, 'private');
        assert.ok(priv.joinCode && priv.joinCode.length >= 8);
        const pub = await service.createCompetition({ ...validDto, visibility: 'public' }, 'alice', 'u1');
        assert.equal(pub.joinCode, null);
    });
    await test('public detail endpoint never exposes the join code', async () => {
        const service = makeService({ id: 'c1', name: 'Private Cup', visibility: 'private', joinCode: 'SECRET42' });
        const comp = await service.getCompetitionById('c1');
        assert.equal(comp.joinCode, undefined);
    });
    await test('joining enforces verification and private join codes', async () => {
        const service = makeService({ id: 'c1', name: 'Private Cup', visibility: 'private', joinCode: 'SECRET42' });
        await expectThrow(() => service.participate('c1', 'SECRET42', { id: 'u2', username: 'bob' }), common_1.ForbiddenException, 'verification is required');
        await expectThrow(() => service.participate('c1', 'WRONG', { id: 'u1', username: 'alice' }), common_1.BadRequestException, 'Invalid join code');
        const ok = await service.participate('c1', 'SECRET42', { id: 'u1', username: 'alice' });
        assert.equal(ok.ok, true);
    });
    await test('registration-closed competitions lock name/game/type/description', async () => {
        const comp = {
            id: 'c1', name: 'Locked Cup', description: 'Original description', game: 'Valorant', type: 'league',
            createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
            prize: 5000, feeType: 'free', registrationCloseAt: past, startDate: future,
            endDate: new Date(future.getTime() + 86_400_000),
        };
        const service = makeService(comp);
        await expectThrow(() => service.updateCompetition('c1', { name: 'Renamed Cup' }, 'alice', 'team_lead'), common_1.BadRequestException, 'Registration has closed');
    });
    await test('prize pool and obsolete fields cannot be modified through edit', async () => {
        const comp = {
            id: 'c1', name: 'Cup', description: 'Original description', game: 'Valorant', type: 'league',
            createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
            prize: 5000, feeType: 'free', startDate: future, endDate: new Date(future.getTime() + 86_400_000),
        };
        const service = makeService(comp);
        await expectThrow(() => service.updateCompetition('c1', { prize: 9000 }, 'alice', 'team_lead'), common_1.BadRequestException, 'prize pool cannot be modified');
        await expectThrow(() => service.updateCompetition('c1', { format: 'Round Robin' }, 'alice', 'team_lead'), common_1.BadRequestException, 'no longer editable');
    });
    await test('capacity cannot be decreased below registered teams/rosters', async () => {
        const comp = {
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
        await expectThrow(() => service.updateCompetition('c1', { maxTeams: 2 }, 'alice', 'team_lead'), common_1.BadRequestException, 'cannot be decreased');
        await expectThrow(() => service.updateCompetition('c1', { maxPlayersPerTeam: 2 }, 'alice', 'team_lead'), common_1.BadRequestException, 'cannot be decreased');
    });
    await test('end date earlier than start date is rejected on edit', async () => {
        const comp = {
            id: 'c1', name: 'Cup', description: 'Original description', game: 'Valorant', type: 'league',
            createdBy: 'alice', organizers: ['alice'], maxTeams: 8, maxPlayersPerTeam: 4,
            prize: 5000, feeType: 'free', startDate: future, endDate: new Date(future.getTime() + 86_400_000),
        };
        const service = makeService(comp);
        await expectThrow(() => service.updateCompetition('c1', { endDate: new Date(future.getTime() - 86_400_000).toISOString() }, 'alice', 'team_lead'), common_1.BadRequestException, 'End Date must be strictly after');
    });
    await test('participant contacts expose real emails only through the organizer path', async () => {
        const comp = { id: 'c1', createdBy: 'alice', organizers: ['alice'], name: 'Cup' };
        const teams = [{ id: 't1', name: 'Alpha', status: 'approved', leaderUsername: 'bob', memberUsernames: ['bob'] }];
        const service = makeService(comp, teams);
        const contacts = await service.getParticipantContacts('c1', 'alice', 'team_lead');
        assert.equal(contacts[0].email, 'bob@nexus.gg');
        assert.equal(contacts[0].role, 'team_lead');
        await expectThrow(() => service.getParticipantContacts('c1', 'bob', 'participant'), common_1.ForbiddenException, 'organizers');
    });
}
async function teamServiceTests() {
    console.log('\nTeamsService');
    function makeService(opts = {}) {
        const competition = opts.competition || {
            id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'],
            visibility: 'public', maxTeams: 8, maxPlayersPerTeam: 3,
            startDate: future, endDate: new Date(future.getTime() + 86_400_000), entryFeeAmount: 0,
        };
        const team = opts.team || {
            id: 't1', name: 'Alpha', competitionId: 'c1', leaderId: 'alice', createdBy: 'alice',
            leaderUsername: 'alice', memberUsernames: ['alice', 'bob'], status: 'approved',
        };
        const saved = [];
        const mutations = [];
        const userRepository = {
            findById: async () => ({ id: 'u1', username: 'alice', verificationStatus: opts.userState || 'verified' }),
            findByUsername: async (name) => ({ id: `u-${name}`, username: name, email: `${name}@nexus.gg` }),
            findAll: async () => [{ id: 'u1', username: 'alice' }, { id: 'u2', username: 'bob' }],
        };
        const teamRepository = {
            findById: async () => team,
            findByCompetition: async () => opts.teams || [team],
            find: async () => opts.teams || [team],
            create: async (name, competitionId, leaderId, members, status) => {
                mutations.push({ op: 'create', name, competitionId, leaderId, members, status });
                return { ...team, id: 't-new', name, leaderId, memberUsernames: [leaderId, ...members], status };
            },
            update: async (_id, updates) => { Object.assign(team, updates); return team; },
            addMember: async (_id, member) => { team.memberUsernames.push(member); return team; },
            removeMember: async (_id, member) => { team.memberUsernames = team.memberUsernames.filter((m) => m !== member); return team; },
            setStatus: async (_id, status) => { mutations.push({ op: 'setStatus', status }); return { ...team, status }; },
        };
        const competitionRepository = { findById: async () => competition };
        const refundRepo = {
            findOne: async () => opts.existingRefund || null,
            create: (data) => ({ id: 'refund-1', ...data }),
            save: async (data) => { saved.push(data); return data; },
        };
        const paid = new Set(opts.paidMembers || []);
        const revenueRepo = { exists: async ({ where }) => paid.has(where.organizerName) };
        const service = new teams_service_1.TeamsService(teamRepository, competitionRepository, userRepository, notifications, noopAudit, refundRepo, revenueRepo);
        return { service, team, competition, saved, mutations };
    }
    await test('unverified users cannot create teams', async () => {
        const { service } = makeService({ userState: 'unverified' });
        await expectThrow(() => service.createTeam({ name: 'Bravo', competitionId: 'c1' }, { id: 'u1', username: 'alice' }), common_1.ForbiddenException, 'verification is required');
    });
    await test('new teams are auto-approved on creation', async () => {
        const { service, mutations } = makeService();
        await service.createTeam({ name: 'Bravo', competitionId: 'c1' }, { id: 'u1', username: 'alice', role: 'team_lead' });
        const created = mutations.find((m) => m.op === 'create');
        assert.ok(created);
        assert.equal(created.status, 'approved');
    });
    await test('private competitions require the correct join code for team creation', async () => {
        const competition = {
            id: 'c1', name: 'Private Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'private', joinCode: 'SECRET42',
            maxTeams: 8, maxPlayersPerTeam: 3, startDate: future, endDate: new Date(future.getTime() + 86_400_000),
        };
        const { service } = makeService({ competition });
        await expectThrow(() => service.createTeam({ name: 'Bravo', competitionId: 'c1' }, { id: 'u1', username: 'alice' }), common_1.BadRequestException, 'Invalid join code');
        const team = await service.createTeam({ name: 'Bravo', competitionId: 'c1', joinCode: 'SECRET42' }, { id: 'u1', username: 'alice' });
        assert.ok(team);
    });
    await test('team capacity is enforced on member addition', async () => {
        const team = {
            id: 't1', name: 'Alpha', competitionId: 'c1', leaderId: 'alice', createdBy: 'alice',
            leaderUsername: 'alice', memberUsernames: ['alice', 'bob', 'carol'], status: 'approved',
        };
        const { service } = makeService({ team });
        await expectThrow(() => service.addMember('t1', { memberId: 'dave' }, { username: 'alice' }), common_1.BadRequestException, 'Team is full');
    });
    await test('removal requires a reason and blocks paid participants', async () => {
        const { service } = makeService({ paidMembers: ['bob'] });
        await expectThrow(() => service.removeMember('t1', 'bob', 'no', { username: 'alice' }), common_1.BadRequestException, 'meaningful removal reason');
        await expectThrow(() => service.removeMember('t1', 'bob', 'Repeated no-shows', { username: 'alice' }), common_1.ForbiddenException, 'has paid the participation fee');
    });
    await test('removal is blocked once the competition has started', async () => {
        const competition = {
            id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'public',
            maxTeams: 8, maxPlayersPerTeam: 3, startDate: past, endDate: new Date(future.getTime() + 86_400_000),
        };
        const { service } = makeService({ competition });
        await expectThrow(() => service.removeMember('t1', 'bob', 'Repeated no-shows', { username: 'alice' }), common_1.ForbiddenException, 'competition has started');
        await expectThrow(() => service.addMember('t1', { memberId: 'carol' }, { username: 'alice' }), common_1.ForbiddenException, 'competition has started');
    });
    await test('disband requires a meaningful reason and is blocked after start', async () => {
        const started = {
            id: 'c1', name: 'Cup', createdBy: 'organizer', organizers: ['organizer'], visibility: 'public',
            maxTeams: 8, maxPlayersPerTeam: 3, startDate: past, endDate: new Date(future.getTime() + 86_400_000),
        };
        const notStarted = { ...started, startDate: future };
        const startedService = makeService({ competition: started }).service;
        const service = makeService({ competition: notStarted }).service;
        await expectThrow(() => service.disbandTeam('t1', 'short', { username: 'alice' }), common_1.BadRequestException, 'meaningful disband reason');
        await expectThrow(() => startedService.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' }), common_1.ForbiddenException, 'not allowed after the competition has started');
    });
    await test('disband records a pending refund for paid participants exactly once', async () => {
        const { service, saved } = makeService({ paidMembers: ['bob'] });
        const result = await service.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' });
        assert.equal(saved.length, 1);
        assert.equal(saved[0].status, 'pending');
        assert.equal(saved[0].username, 'bob');
        assert.equal(result.refunds[0].status, 'pending');
        const existing = makeService({
            paidMembers: ['bob'],
            existingRefund: { id: 'refund-existing', refundKey: 'disband:t1:bob', username: 'bob', amount: 100, status: 'pending' },
        });
        const again = await existing.service.disbandTeam('t1', 'Team is inactive and cannot continue', { username: 'alice' });
        assert.equal(existing.saved.length, 0);
        assert.equal(again.refunds[0].status, 'pending');
    });
}
async function matchServiceTests() {
    console.log('\nMatchesService');
    function makeService(opts = {}) {
        const competition = opts.competition || {
            id: 'c1', name: 'Cup', type: 'league', format: 'Round Robin', status: 'active',
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
            create: (data) => ({ id: `m${++counter}`, ...data }),
            save: async (match) => {
                const idx = matches.findIndex((m) => m.id === match.id);
                if (idx >= 0)
                    matches[idx] = match;
                else
                    matches.push(match);
                return match;
            },
            find: async ({ where } = {}) => matches.filter((m) => Object.entries(where || {}).every(([k, v]) => m[k] === v)),
            findOne: async ({ where }) => matches.find((m) => m.id === where.id) || null,
            update: async (id, updates) => {
                const match = matches.find((m) => m.id === id);
                if (match)
                    Object.assign(match, updates);
                return match;
            },
            count: async ({ where } = {}) => matches.filter((m) => Object.entries(where || {}).every(([k, v]) => m[k] === v)).length,
            delete: async () => undefined,
        };
        const competitionRepository = {
            findById: async () => competition,
            update: async (_id, updates) => { Object.assign(competition, updates); return competition; },
        };
        const teamRepository = {
            findById: async (id) => teams.find((t) => t.id === id) || null,
            findByCompetition: async () => teams,
        };
        return {
            service: new matches_service_1.MatchesService(repo, competitionRepository, teamRepository, notifications, noopAudit),
            matches,
            competition,
            repo,
        };
    }
    await test('manual scheduling rejects out-of-window and overlapping matches', async () => {
        const existing = [{
                id: 'm0', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
                status: 'scheduled', scheduledAt: new Date('2026-02-10T10:00:00Z'),
            }];
        const { service } = makeService({ matches: existing });
        await expectThrow(() => service.create({ competitionId: 'c1', team1Id: 'tC', team2Id: 'tD', scheduledAt: new Date('2026-03-10T10:00:00Z') }), common_1.BadRequestException, 'after the competition end date');
        await expectThrow(() => service.create({ competitionId: 'c1', team1Id: 'tA', team2Id: 'tC', scheduledAt: new Date('2026-02-10T10:15:00Z') }), common_1.BadRequestException, 'Overlapping match');
    });
    await test('verified results cannot be submitted twice or changed by scheduling', async () => {
        const match = {
            id: 'm1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
            status: 'completed', winnerId: 'tA', winnerName: 'A', score: '2-0', round: 'Round 1',
        };
        const { service } = makeService({ matches: [match] });
        await expectThrow(() => service.recordResult('m1', 'tA', 'A', '2-0', 'organizer'), common_1.BadRequestException, 'Duplicate submissions');
        await expectThrow(() => service.updateSchedule('m1', { scheduledAt: new Date('2026-02-12T10:00:00Z') }, 'organizer'), common_1.ForbiddenException, 'cannot be modified');
    });
    await test('only a participating team can be declared winner', async () => {
        const match = {
            id: 'm1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
            status: 'scheduled', round: 'Round 1',
        };
        const { service } = makeService({ matches: [match] });
        await expectThrow(() => service.recordResult('m1', 'tC', 'C', '2-0', 'organizer'), common_1.BadRequestException, 'participating team');
        await expectThrow(() => service.recordResult('m1', 'tA', 'A', '', 'organizer'), common_1.BadRequestException, 'score is required');
    });
    await test('elimination winner advances to the next bracket round only after both results', async () => {
        const m1 = { id: 'm1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B', status: 'scheduled', round: 'Round 1' };
        const m2 = { id: 'm2', competitionId: 'c1', team1Id: 'tC', team2Id: 'tD', team1Name: 'C', team2Name: 'D', status: 'completed', winnerId: 'tC', winnerName: 'C', score: '2-0', round: 'Round 1' };
        const competition = {
            id: 'c1', name: 'Knockout', type: 'tournament', format: 'Single Elimination', status: 'active',
            startDate: new Date('2026-02-01T00:00:00Z'), endDate: new Date('2026-02-28T00:00:00Z'),
        };
        const { service, matches } = makeService({ competition, matches: [m1, m2] });
        await service.recordResult('m1', 'tA', 'A', '2-1', 'organizer');
        const next = matches.find((m) => m.round === 'Semifinal');
        assert.ok(next, 'expected a Semifinal fixture to be created');
        assert.deepEqual([next.team1Name, next.team2Name].sort(), ['A', 'C']);
    });
    await test('final verified result declares the tournament winner', async () => {
        const final = { id: 'mF', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B', status: 'scheduled', round: 'Final' };
        const competition = {
            id: 'c1', name: 'Knockout', type: 'tournament', format: 'Single Elimination', status: 'active',
            startDate: new Date('2026-02-01T00:00:00Z'), endDate: new Date('2026-02-28T00:00:00Z'),
        };
        const { service } = makeService({ competition, matches: [final] });
        await service.recordResult('mF', 'tA', 'A', '3-1', 'organizer');
        assert.equal(competition.status, 'completed');
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
    });
    await test('regeneration with scheduled fixtures requires explicit confirmation', async () => {
        const scheduled = {
            id: 's1', competitionId: 'c1', team1Id: 'tA', team2Id: 'tB', team1Name: 'A', team2Name: 'B',
            status: 'scheduled', round: 'Round 1',
        };
        const { service } = makeService({ matches: [scheduled] });
        await expectThrow(() => service.generateSchedule('c1', 'organizer', {}), common_1.BadRequestException, 'confirmOverlap=true');
    });
}
async function main() {
    console.log('NEXUS ESPORTS — workflow test suite');
    await competitionRuleTests();
    await tournamentTests();
    await verificationTests();
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
//# sourceMappingURL=run-tests.js.map