/**
 * NEXUS ESPORTS — organiser reputation, prize-pool enforcement and reporting rules.
 *
 * Run with: npm test (backend)
 *
 * Service-level tests with in-memory repository fakes, so the real transition
 * rules and the backend prize-pool gate are exercised without PostgreSQL.
 */
import 'reflect-metadata';
import assert = require('node:assert/strict');
import { BadRequestException } from '@nestjs/common';
import { ReputationService } from '../src/modules/reputation/reputation.service';
import { OrganiserReputationEntity } from '../src/entities/organiser-reputation.entity';
import { OrganiserReputationHistoryEntity } from '../src/entities/organiser-reputation-history.entity';
import { OrganiserSanctionEntity } from '../src/entities/organiser-sanction.entity';
import { PrizePoolExceptionEntity } from '../src/entities/prize-pool-exception.entity';
import { PlatformSettingEntity } from '../src/entities/platform-setting.entity';
import {
  MAX_DISCARDED_REPORTS,
  REPORT_REASONS,
  REPUTATION_LEVEL_LIMITS,
} from '../src/common/reporting';
import { MAX_PRIZE_POOL } from '../src/common/validation/competition.rules';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err?.message || err}`);
  }
}

const isNullOperator = (value: any) => value && typeof value === 'object' && value.type === 'isNull';

const matches = (row: any, where: any) =>
  Object.entries(where || {}).every(([key, expected]: [string, any]) => {
    if (isNullOperator(expected)) return row[key] === null || row[key] === undefined;
    return row[key] === expected;
  });

class FakeRepo {
  rows: any[] = [];
  private seq = 1;

  create(data: any) {
    return { ...data };
  }

  private keyOf(row: any) {
    return row.id !== undefined ? 'id' : 'username';
  }

  async save(entity: any) {
    const row = { ...entity };
    const key = this.keyOf(row);
    if (row.id === undefined) row.id = `generated-${this.seq++}`;
    const index = this.rows.findIndex((candidate) => candidate[key] === row[key]);
    if (index >= 0) {
      this.rows[index] = { ...this.rows[index], ...row };
      return this.rows[index];
    }
    this.rows.push(row);
    return row;
  }

  async findOne(options: any) {
    return this.rows.find((row) => matches(row, options?.where)) || null;
  }

  async find(options: any = {}) {
    const where = options.where;
    let rows = Array.isArray(where)
      ? this.rows.filter((row) => where.some((clause) => matches(row, clause)))
      : this.rows.filter((row) => matches(row, where));
    if (options.take) rows = rows.slice(0, options.take);
    return rows;
  }

  async upsert(entity: any) {
    const key = this.keyOf(entity);
    const index = this.rows.findIndex((row) => row[key] === entity[key]);
    if (index >= 0) this.rows[index] = { ...this.rows[index], ...entity };
    else this.rows.push({ ...entity });
    return entity;
  }

  async count(options: any) {
    return (await this.find(options)).length;
  }

  createQueryBuilder() {
    const repo = this;
    return {
      update: () => ({
        set: (patch: any) => ({
          where: (sql: string, params: any) => ({
            execute: async () => {
              const row = repo.rows.find(
                (candidate) =>
                  candidate.id === params.id &&
                  candidate.status === params.status &&
                  (candidate.competitionId === null || candidate.competitionId === undefined) &&
                  Number(candidate.requestedAmount) >= Number(params.amount),
              );
              if (!row) return { affected: 0 };
              Object.assign(row, patch);
              return { affected: 1 };
            },
          }),
        }),
      }),
    };
  }
}

function makeService() {
  // One repository fake per entity, shared by the service and by the
  // transaction manager (exactly like a real DataSource + EntityManager).
  const rep = new FakeRepo();
  const history = new FakeRepo();
  const sanctions = new FakeRepo();
  const exceptions = new FakeRepo();
  const settings = new FakeRepo();
  const repositories = new Map<any, FakeRepo>([
    [OrganiserReputationEntity, rep],
    [OrganiserReputationHistoryEntity, history],
    [OrganiserSanctionEntity, sanctions],
    [PrizePoolExceptionEntity, exceptions],
    [PlatformSettingEntity, settings],
  ]);
  const repoFor = (entity: any) => {
    if (!repositories.has(entity)) repositories.set(entity, new FakeRepo());
    return repositories.get(entity)!;
  };
  const manager = { getRepository: (entity: any) => repoFor(entity) };
  const dataSource = { transaction: async (fn: any) => fn(manager) };
  const notifications = { create: async (..._args: any[]) => undefined as any };
  const auditLog = { record: async () => undefined };
  const service = new ReputationService(
    rep as any,
    history as any,
    sanctions as any,
    exceptions as any,
    settings as any,
    dataSource as any,
    notifications as any,
    auditLog as any,
  );
  return { service, rep, settings, exceptions, sanctions };
}

async function main() {
  console.log('\nOrganiser reputation levels');
  const { service, rep, settings, exceptions, sanctions } = makeService();

  await test('new organisers start Blue with the ₹3,00,000 platform ceiling', async () => {
    const profile = await service.getProfile('neworganiser');
    assert.equal(profile.level, 'blue');
    assert.equal(profile.levelLimit, 300000);
    assert.equal(profile.limit, 300000);
    assert.equal(MAX_PRIZE_POOL, 300000);
    assert.equal(REPUTATION_LEVEL_LIMITS.orange, 20000);
    assert.equal(REPUTATION_LEVEL_LIMITS.red, 10000);
  });

  await test('Blue → Green needs more than 3 qualifying ₹50k+ tournaments with on-time payments', async () => {
    await service.evaluate('grower', { qualifyingAmount: 50000, paidOnTime: true }, 'communitymod');
    await service.evaluate('grower', { qualifyingAmount: 50000, paidOnTime: true }, 'communitymod');
    await service.evaluate('grower', { qualifyingAmount: 50000, paidOnTime: true }, 'communitymod');
    assert.equal((await service.getProfile('grower')).level, 'blue');
    await service.evaluate('grower', { qualifyingAmount: 50000, paidOnTime: true }, 'communitymod');
    assert.equal((await service.getProfile('grower')).level, 'green');
  });

  await test('Blue → Orange requires repeated substantiated lower-severity issues', async () => {
    await service.evaluate('slipping', { overduePayments: 1 }, 'communitymod');
    assert.equal((await service.getProfile('slipping')).level, 'blue');
    await service.evaluate('slipping', { overduePayments: 1 }, 'communitymod');
    const profile = await service.getProfile('slipping');
    assert.equal(profile.level, 'orange');
    assert.equal(profile.limit, 20000);
  });

  await test('Blue → Red for substantiated serious misconduct', async () => {
    const result = await service.evaluate('fraudster', { seriousMisconduct: true, reason: 'Deliberate prize non-payment confirmed.' }, 'communitymod');
    assert.equal(result.level, 'red');
    assert.equal((await service.getProfile('fraudster')).limit, 10000);
  });

  await test('Orange → Blue recovery, then a second Orange escalates to Red', async () => {
    const record = await rep.save(rep.create({ username: 'repeat', level: 'orange', orangeRecoveryCount: 0 }));
    assert.ok(record.username);
    for (let i = 0; i < 3; i += 1) {
      await service.evaluate('repeat', { qualifyingAmount: 7000, paidOnTime: true }, 'communitymod');
    }
    const recovered = await service.getProfile('repeat');
    assert.equal(recovered.level, 'blue');
    assert.equal(recovered.counters.orangeRecoveryCount, 1);

    await service.evaluate('repeat', { overduePayments: 2 }, 'communitymod');
    assert.equal((await service.getProfile('repeat')).level, 'red');
  });

  await test('Red → Orange recovery after 3 additional ₹5k+ tournaments', async () => {
    await rep.save(rep.create({ username: 'recovering', level: 'red' }));
    for (let i = 0; i < 3; i += 1) {
      await service.evaluate('recovering', { qualifyingAmount: 5000, paidOnTime: true }, 'communitymod');
    }
    assert.equal((await service.getProfile('recovering')).level, 'orange');
  });

  await test('Red non-payment triggers a one-month ban, then a lifetime ban on repeat', async () => {
    await rep.save(rep.create({ username: 'banned', level: 'red' }));
    const first = await service.evaluate('banned', { failedPaymentDuringRecovery: true }, 'communitymod');
    assert.equal(first.level, 'red');
    let profile = await service.getProfile('banned');
    assert.equal(profile.banCount, 1);
    assert.ok(profile.bannedUntil && new Date(profile.bannedUntil).getTime() > Date.now());
    assert.ok(sanctions.rows.some((row: any) => row.username === 'banned' && row.type === 'one_month_ban'));

    // Ban completed, then another qualifying failure in the recovery window.
    const row = await rep.findOne({ where: { username: 'banned' } });
    row.bannedUntil = new Date(Date.now() - 1000);
    await rep.save(row);
    await service.evaluate('banned', { failedPaymentDuringRecovery: true }, 'communitymod');
    profile = await service.getProfile('banned');
    assert.equal(profile.lifetimeBan, true);
    assert.ok(sanctions.rows.some((row: any) => row.username === 'banned' && row.type === 'lifetime_ban'));
    await assert.rejects(() => service.assertCanOrganise('banned'), /permanently banned/i);
  });

  await test('Green downgrades for repeated medium-severity violations', async () => {
    await rep.save(rep.create({ username: 'greeny', level: 'green' }));
    await service.evaluate('greeny', { mediumViolations: 2 }, 'communitymod');
    assert.equal((await service.getProfile('greeny')).level, 'orange');
  });

  console.log('\nPrize-pool enforcement');

  await test('Blue and Green are limited by the ₹3,00,000 ceiling, Orange and Red by their own limit', async () => {
    assert.equal((await service.authorizePrizePool(300000, 'neworganiser')).limit, 300000);
    await service.evaluate('orangeguy', { overduePayments: 2 }, 'communitymod');
    await assert.rejects(() => service.authorizePrizePool(50000, 'orangeguy'), /₹20,000/);
    await assert.rejects(() => service.authorizePrizePool(10001, 'fraudster'), /₹10,000/);
    assert.equal((await service.authorizePrizePool(10000, 'fraudster')).limit, 10000);
  });

  await test('No organiser can exceed the platform ceiling, even with an approved exception', async () => {
    await assert.rejects(() => service.authorizePrizePool(300001, 'neworganiser'), /platform-wide maximum/i);
    await assert.rejects(() => service.requestException('neworganiser', 300001, 'Test exception above the ceiling.'), /never exceed/i);
  });

  await test('A configurable ceiling is enforced centrally', async () => {
    await service.setGlobalMax(100000, 'superadmin1');
    assert.equal(await service.getGlobalMax(), 100000);
    await assert.rejects(() => service.authorizePrizePool(150000, 'neworganiser'), /platform-wide maximum/i);
    await service.setGlobalMax(300000, 'superadmin1');
  });

  await test('An approved exception applies to one competition and disappears when consumed', async () => {
    const request = await service.requestException('orangeguy', 100000, 'Sponsor-backed event above the Orange limit.');
    await service.reviewException(request.id, 'approved', 'Approved for one event.', 'compadmin');
    const gate = await service.authorizePrizePool(50000, 'orangeguy');
    assert.equal(gate.exceptionId, request.id);
    await service.consumeException(request.id, 'competition-1', 50000);
    await assert.rejects(() => service.consumeException(request.id, 'competition-2', 50000), /no longer available/i);
    // The permanent limit and reputation are untouched by the exception.
    const profile = await service.getProfile('orangeguy');
    assert.equal(profile.level, 'orange');
    assert.equal(profile.limit, 20000);
    assert.equal(exceptions.rows.find((row: any) => row.id === request.id).competitionId, 'competition-1');
    // Without a fresh exception the Orange limit still applies.
    await assert.rejects(() => service.authorizePrizePool(50000, 'orangeguy'), /₹20,000/);
  });

  await test('Reputation and sanction history is written for every change', async () => {
    const history = await service.getHistory('fraudster');
    assert.ok(history.reputationHistory.length >= 1);
    assert.equal(history.reputationHistory[0].toLevel, 'red');
    assert.ok(history.reputationHistory[0].reviewer);
    assert.ok(history.reputationHistory[0].reason);
  });

  console.log('\nReporting policy constants');

  await test('priority follows the backend reason catalogue, never the UI', () => {
    assert.equal(REPORT_REASONS.cheating.priority, 'high');
    assert.equal(REPORT_REASONS.harassment.priority, 'medium');
    assert.equal(REPORT_REASONS.offensive_name.priority, 'low');
    assert.equal(REPORT_REASONS.prize_not_received.category, 'financial');
    assert.equal(MAX_DISCARDED_REPORTS, 3);
    assert.equal(settings.rows.length, 1); // only the platform ceiling row
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
