/**
 * NEXUS ESPORTS — security and permission tests for the audit fixes.
 *
 * Service-level tests with in-memory fakes; no database needed.
 */
import 'reflect-metadata';
import assert = require('node:assert/strict');
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { UpdateProfileDto, AddAdminDto, RegisterDto } from '../src/modules/auth/dto/auth.dto';
import { DisputesService } from '../src/modules/disputes/disputes.service';
import { CreateCompetitionDto } from '../src/modules/competitions/dto/competition.dto';
import { CreateTeamDto } from '../src/modules/teams/dto/team.dto';
import { requireJwtSecret } from '../src/common/config/jwt-secret';
import { detectFileType, looksLikePlainText } from '../src/modules/upload/upload.service';
import { validateDateWindow, validateFutureDates, validatePrizeDistribution } from '../src/common/validation/competition.rules';
import { DisputeStatus, DisputeTargetType, UserRole } from '../src/common/interfaces';

let passed = 0;
let failed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed += 1; console.log(`  PASS  ${name}`); }
  catch (err: any) { failed += 1; failures.push(`${name}: ${err?.message || err}`); console.log(`  FAIL  ${name}`); }
}
async function rejects(fn: () => Promise<unknown>, type: any, text?: string) {
  try { await fn(); } catch (err: any) {
    assert.ok(err instanceof type, `expected ${type.name}, got ${err?.constructor?.name}: ${err?.message}`);
    if (text) assert.match(String(err.message), new RegExp(text, 'i'));
    return;
  }
  assert.fail(`expected ${type.name}`);
}
const errorsFor = async (cls: any, body: any) => validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true });

// ── Fake user store ──────────────────────────────────────────────────────────
async function makeAuth() {
  const users: any[] = [
    { id: 'u-super', username: 'boss', email: 'boss@x.gg', role: UserRole.SUPER_ADMIN, adminType: 'super_admin', banned: false, warningCount: 0 },
    // A legacy row still holding the retired Admin role.
    { id: 'u-admin', username: 'adm', email: 'adm@x.gg', role: 'admin', adminType: 'admin', banned: false, warningCount: 0 },
    { id: 'u-fin', username: 'fin', email: 'fin@x.gg', role: UserRole.FINANCE_MODERATOR, adminType: 'finance_moderator', banned: false, warningCount: 0 },
    { id: 'u-p', username: 'player', email: 'p@x.gg', role: UserRole.PARTICIPANT, adminType: null, banned: false, warningCount: 0 },
  ];
  for (const u of users) u.passwordHash = await bcrypt.hash('secret1', 4);
  const strip = (u: any) => { if (!u) return u; const { passwordHash, ...rest } = u; return rest; };
  const find = (v: string) => users.find((u) => [u.username, u.email].some((x) => x.toLowerCase() === String(v).toLowerCase()));
  const repo: any = {
    findAll: async () => users.map(strip),
    findById: async (id: string) => strip(users.find((u) => u.id === id)),
    findWithPasswordById: async (id: string) => users.find((u) => u.id === id) || null,
    findByUsername: async (n: string) => strip(users.find((u) => u.username.toLowerCase() === n.toLowerCase())),
    findByEmail: async (e: string) => strip(users.find((u) => u.email.toLowerCase() === e.toLowerCase())),
    findByEmailOrUsername: async (v: string) => strip(find(v)),
    findWithPasswordByEmailOrUsername: async (v: string) => find(v) || null,
    emailExists: async (e: string) => users.some((u) => u.email.toLowerCase() === e.toLowerCase()),
    usernameExists: async (n: string) => users.some((u) => u.username.toLowerCase() === n.toLowerCase()),
    createWithPassword: async (email: string, username: string, password: string, role: string, adminType: string) => {
      const u = { id: `u-${username}`, email, username, role, adminType, banned: false, warningCount: 0, passwordHash: await bcrypt.hash(password, 4) };
      users.push(u);
      return strip(u);
    },
    update: async (id: string, updates: any) => { Object.assign(users.find((u) => u.id === id), updates); return strip(users.find((u) => u.id === id)); },
    updatePassword: async (id: string, hash: string) => { users.find((u) => u.id === id).passwordHash = hash; },
    setBanned: async (id: string, banned: boolean) => { users.find((u) => u.id === id).banned = banned; },
    incrementWarning: async (n: string) => { const u = find(n); u.warningCount += 1; u.banned = u.warningCount >= 3; return { warningCount: u.warningCount, banned: u.banned }; },
  };
  const service = new AuthService(repo, { sign: () => 'token' } as any, { create: async () => ({}) } as any, { record: async () => undefined } as any);
  return { service, users };
}

async function main() {
  console.log('Security and permission tests');

  await test('PATCH /auth/profile rejects role, email and username fields', async () => {
    for (const field of ['role', 'adminType', 'email', 'username', 'banned']) {
      const errors = await errorsFor(UpdateProfileDto, { bio: 'hi', [field]: 'super_admin' });
      assert.ok(errors.length > 0, `${field} must be rejected`);
    }
    assert.equal((await errorsFor(UpdateProfileDto, { bio: 'Just a bio' })).length, 0);
  });

  await test('profile updates only ever write bio and picture', async () => {
    const { service, users } = await makeAuth();
    await service.updateProfile('u-p', { bio: 'hello', role: 'super_admin' } as any);
    assert.equal(users.find((u) => u.id === 'u-p').role, UserRole.PARTICIPANT);
  });

  await test('usernames are validated', async () => {
    assert.ok((await errorsFor(RegisterDto, { email: 'a@b.gg', username: 'bad name', password: 'secret1' })).length);
    assert.ok((await errorsFor(RegisterDto, { email: 'a@b.gg', username: '<b>x</b>', password: 'secret1' })).length);
    assert.equal((await errorsFor(RegisterDto, { email: 'a@b.gg', username: 'good_name.1', password: 'secret1' })).length, 0);
  });

  await test('registration treats usernames and emails case-insensitively', async () => {
    const { service } = await makeAuth();
    await rejects(() => service.register({ email: 'NEW@x.gg', username: 'PLAYER', password: 'secret1' }), Error, 'taken');
    await rejects(() => service.register({ email: 'P@X.GG', username: 'fresh', password: 'secret1' }), Error, 'already registered');
  });

  await test('login gives the same error for an unknown account and a wrong password', async () => {
    const { service } = await makeAuth();
    let a = '', b = '';
    try { await service.login({ emailOrUsername: 'nobody', password: 'x' }); } catch (e: any) { assert.ok(e instanceof UnauthorizedException); a = e.message; }
    try { await service.login({ emailOrUsername: 'player', password: 'wrong' }); } catch (e: any) { assert.ok(e instanceof UnauthorizedException); b = e.message; }
    assert.equal(a, b);
  });

  await test('change password loads the stored hash and works', async () => {
    const { service } = await makeAuth();
    await rejects(() => service.changePassword('u-p', 'wrong', 'newpass1'), UnauthorizedException);
    await service.changePassword('u-p', 'secret1', 'newpass1');
    const res = await service.login({ emailOrUsername: 'player', password: 'newpass1' });
    assert.equal(res.access_token, 'token');
  });

  await test('a retired Admin account cannot sign in, and there is no manual ban', async () => {
    const { service } = await makeAuth();
    await rejects(() => service.login({ emailOrUsername: 'adm', password: 'secret1' }), UnauthorizedException, 'removed');
    assert.equal(typeof (service as any).banUser, 'undefined');
  });

  await test('moderation cannot target a Super Admin or yourself, and only a Super Admin may warn staff', async () => {
    const { service } = await makeAuth();
    const fin = { id: 'u-fin', username: 'fin', role: UserRole.FINANCE_MODERATOR, adminType: 'finance_moderator' };
    await rejects(() => service.warnUser('boss', fin), ForbiddenException, 'Super Admin');
    await rejects(() => service.warnUser('fin', fin), ForbiddenException, 'own');
    const boss = { id: 'u-super', username: 'boss', role: UserRole.SUPER_ADMIN, adminType: 'super_admin' };
    assert.equal((await service.warnUser('player', boss)).warningCount, 1);
  });

  await test('a Super Admin cannot revoke themselves', async () => {
    const { service } = await makeAuth();
    await rejects(() => service.revokeAdmin('boss', 'x', { id: 'u-super', username: 'boss', role: UserRole.SUPER_ADMIN }), ForbiddenException, 'own');
  });

  await test('add admin validates the role and never uses a default password or returns a hash', async () => {
    assert.ok((await errorsFor(AddAdminDto, { username: 'newmod', adminType: 'totally_fake_role' })).length);
    const { service } = await makeAuth();
    // The retired Admin role can no longer be granted.
    assert.ok((await errorsFor(AddAdminDto, { username: 'newmod', adminType: 'admin' })).length);
    const res: any = await service.addAdmin({ username: 'newmod', adminType: 'finance_moderator' } as any, { username: 'boss' });
    assert.equal(res.created, true);
    assert.ok(res.temporaryPassword && res.temporaryPassword !== 'nexus' && res.temporaryPassword.length >= 10);
    assert.equal('passwordHash' in res.user, false);
    const login = await service.login({ emailOrUsername: 'newmod', password: res.temporaryPassword });
    assert.equal(login.user.role, 'finance_moderator');
  });

  await test('username search offers only player accounts to players and never returns emails', async () => {
    const { service } = await makeAuth();
    const players = await service.searchUsernames('p', 'players', 'boss');
    assert.deepEqual(players.map((u: any) => u.username), ['player']);
    assert.equal('email' in players[0], false);
    assert.deepEqual((await service.searchUsernames('ad', 'players', 'boss')), [], 'staff are never offered as players');
    assert.deepEqual((await service.searchUsernames('ad', 'all', 'boss')).map((u: any) => u.username), ['adm']);
    assert.deepEqual(await service.searchUsernames('player', 'players', 'player'), [], 'you are never offered to yourself');
  });

  await test('the API refuses to start without JWT_SECRET', () => {
    assert.throws(() => requireJwtSecret({ get: () => undefined } as any), /JWT_SECRET/);
    assert.equal(requireJwtSecret({ get: () => 'abc' } as any), 'abc');
  });

  // ── Disputes ──────────────────────────────────────────────────────────────
  const comp = { id: '11111111-1111-4111-8111-111111111111', name: 'Cup', createdBy: 'org', organizers: ['org'], paymentStatus: 'OPEN_FOR_REGISTRATION', status: 'active' };
  const teams = [
    { id: '22222222-2222-4222-8222-222222222222', name: 'Alpha', competitionId: comp.id, memberUsernames: ['alice'], status: 'approved' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Bravo', competitionId: comp.id, memberUsernames: ['bob'], status: 'approved' },
  ];
  function makeDisputes(dispute: any) {
    const store = new Map([[dispute.id, dispute]]);
    return new DisputesService(
      { findById: async (id: string) => store.get(id) || null, update: async (id: string, u: any) => Object.assign(store.get(id), u), create: async (d: any) => ({ id: 'new', ...d }), findByCompetition: async () => [...store.values()], findAll: async () => [...store.values()] } as any,
      { findById: async (id: string) => (id === comp.id ? comp : null) } as any,
      { findByCompetition: async () => teams, findAll: async () => teams } as any,
      { findAll: async () => [], banUser: async () => true, findByUsername: async () => null } as any,
      { create: async () => ({}) } as any,
      { record: async () => undefined } as any,
      { get: (_k: string, d: any) => d } as any,
    );
  }
  const openDispute = () => ({ id: '44444444-4444-4444-8444-444444444444', competitionId: comp.id, reportedBy: 'alice', targetType: DisputeTargetType.OPPONENT_TEAM, targetUserOrTeam: 'Bravo', teamId: teams[0].id, status: DisputeStatus.OPEN_ORGANIZER, reason: 'Wrong score entered', createdAt: new Date() });

  await test('an unrelated team lead cannot resolve another competition\'s dispute', async () => {
    const service = makeDisputes(openDispute());
    await rejects(() => service.organizerReviewDispute(openDispute().id, { action: 'resolve', notes: 'closing it' } as any, { username: 'cap_zoya', role: UserRole.TEAM_LEAD }), ForbiddenException);
    const done = await service.organizerReviewDispute(openDispute().id, { action: 'resolve', notes: 'Score verified' } as any, { username: 'org', role: UserRole.PARTICIPANT });
    assert.equal(done.status, DisputeStatus.RESOLVED);
  });

  await test('disputes are readable only by participants involved, organizers and staff', async () => {
    const service = makeDisputes(openDispute());
    const id = openDispute().id;
    await rejects(() => service.getDisputeById(id, { username: 'stranger', role: UserRole.PARTICIPANT }), ForbiddenException);
    assert.ok(await service.getDisputeById(id, { username: 'bob', role: UserRole.PARTICIPANT }));
    assert.ok(await service.getDisputeById(id, { username: 'org', role: UserRole.PARTICIPANT }));
    assert.ok(await service.getDisputeById(id, { username: 'fin', role: UserRole.FINANCE_MODERATOR }));
  });

  await test('finance can resolve a dispute that blocks settlement', async () => {
    const service = makeDisputes(openDispute());
    const done = await service.adminResolveDispute(openDispute().id, { action: 'resolve', resolutionNotes: 'Reviewed the replay' } as any, { username: 'fin', role: UserRole.FINANCE_MODERATOR });
    assert.equal(done.status, DisputeStatus.RESOLVED);
  });

  await test('only players in the competition can raise a dispute, and the competition must exist', async () => {
    const service = makeDisputes(openDispute());
    const body: any = { competitionId: comp.id, targetType: DisputeTargetType.OPPONENT_TEAM, targetUserOrTeam: 'Bravo', reason: 'They used an exploit' };
    await rejects(() => service.createDispute(body, { username: 'outsider', role: UserRole.PARTICIPANT }), ForbiddenException);
    await rejects(() => service.createDispute({ ...body, competitionId: '55555555-5555-4555-8555-555555555555' }, { username: 'alice' }), NotFoundException);
    const created: any = await service.createDispute(body, { username: 'alice', role: UserRole.PARTICIPANT });
    assert.equal(created.teamId, teams[0].id);
  });

  await test('a player escalates only after 24 hours or an organizer decision', async () => {
    const service = makeDisputes(openDispute());
    await rejects(() => service.escalateByReporter(openDispute().id, 'organizer is silent', { username: 'alice' }), BadRequestException, '24 hours');
    const old = { ...openDispute(), createdAt: new Date(Date.now() - 25 * 3600000) };
    const later = makeDisputes(old);
    await rejects(() => later.escalateByReporter(old.id, 'organizer is silent', { username: 'bob' }), ForbiddenException);
    const escalated: any = await later.escalateByReporter(old.id, 'organizer is silent', { username: 'alice' });
    assert.equal(escalated.status, DisputeStatus.ESCALATED_TO_ADMIN);
  });

  // ── Competition and team input rules ───────────────────────────────────────
  await test('the API rejects invalid competition values', async () => {
    const base = { name: 'Monsoon Cup', description: 'A friendly community cup.', startDate: new Date().toISOString(), endDate: new Date().toISOString() };
    for (const bad of [{ maxTeams: -5 }, { maxTeams: 0 }, { maxTeams: 1000000 }, { maxPlayersPerTeam: 500 }, { feeType: 'xyz' }, { entryFeeAmount: -50 }, { prize: 100.555 }, { game: 'Anything' }, { format: 'Any text' }, { name: 'x'.repeat(500) }]) {
      assert.ok((await errorsFor(CreateCompetitionDto, { ...base, ...bad })).length > 0, JSON.stringify(bad));
    }
  });

  await test('registration must close before start, and dates must be in the future', () => {
    const d = (h: number) => new Date(Date.now() + h * 3600000);
    assert.ok(validateDateWindow({ registrationOpenAt: d(1), registrationCloseAt: d(100), startDate: d(50), endDate: d(200) }).length);
    assert.ok(validateDateWindow({ registrationOpenAt: d(300), registrationCloseAt: d(301), startDate: d(50), endDate: d(200) }).length);
    assert.deepEqual(validateDateWindow({ registrationOpenAt: d(1), registrationCloseAt: d(2), startDate: d(50), endDate: d(60) }), []);
    assert.ok(validateFutureDates({ startDate: d(-5) }).length);
  });

  await test('prize places must descend and be whole rupees', () => {
    assert.match(String(validatePrizeDistribution([{ amount: 100 }, { amount: 0 }, { amount: 500 }])), /Place 3/);
    assert.match(String(validatePrizeDistribution([{ amount: 100.75 }])), /whole rupees/);
    assert.equal(validatePrizeDistribution([{ amount: 600 }, { amount: 300 }, { amount: 100 }]), null);
  });

  await test('team names have a length limit and cannot contain markup', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    assert.ok((await errorsFor(CreateTeamDto, { name: 'x'.repeat(500), competitionId: id })).length);
    assert.ok((await errorsFor(CreateTeamDto, { name: '<img src=x>', competitionId: id })).length);
    assert.equal((await errorsFor(CreateTeamDto, { name: 'Alpha Squad', competitionId: id })).length, 0);
  });

  await test('uploads are typed by content, not by the declared type', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    assert.equal(detectFileType(png)?.mime, 'image/png');
    assert.equal(detectFileType(Buffer.from('<svg onload=alert(1)>')), null);
    assert.equal(looksLikePlainText(Buffer.from('<svg onload=alert(1)></svg>')), false);
    assert.equal(looksLikePlainText(Buffer.from('plain notes')), true);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log(` - ${f}`)); process.exitCode = 1; }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
