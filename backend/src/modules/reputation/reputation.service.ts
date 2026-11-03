import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { OrganiserReputationEntity } from '../../entities/organiser-reputation.entity';
import { OrganiserReputationHistoryEntity } from '../../entities/organiser-reputation-history.entity';
import { OrganiserSanctionEntity } from '../../entities/organiser-sanction.entity';
import { PrizePoolExceptionEntity } from '../../entities/prize-pool-exception.entity';
import { PlatformSettingEntity } from '../../entities/platform-setting.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import {
  DEFAULT_GLOBAL_MAX_PRIZE_POOL,
  QUALIFYING_THRESHOLDS,
  RECOVERY_COMPETITIONS_REQUIRED,
  RED_BAN_DAYS,
  REPUTATION_LEVEL_LIMITS,
  REPUTATION_LEVELS,
  ReputationLevel,
  SanctionType,
  isReputationLevel,
} from '../../common/reporting';

export interface ReputationFacts {
  qualifyingAmount?: number;
  paidOnTime?: boolean;
  seriousMisconduct?: boolean;
  mediumViolations?: number;
  overduePayments?: number;
  outstandingObligations?: number;
  failedPaymentDuringRecovery?: boolean;
  involvedInValidDispute?: boolean;
  reason?: string;
  reportId?: string;
}

const levelRank = (level: ReputationLevel) => REPUTATION_LEVELS.indexOf(level);

@Injectable()
export class ReputationService implements OnModuleInit {
  constructor(
    @InjectRepository(OrganiserReputationEntity)
    private readonly reputation: Repository<OrganiserReputationEntity>,
    @InjectRepository(OrganiserReputationHistoryEntity)
    private readonly history: Repository<OrganiserReputationHistoryEntity>,
    @InjectRepository(OrganiserSanctionEntity)
    private readonly sanctions: Repository<OrganiserSanctionEntity>,
    @InjectRepository(PrizePoolExceptionEntity)
    private readonly exceptions: Repository<PrizePoolExceptionEntity>,
    @InjectRepository(PlatformSettingEntity)
    private readonly settings: Repository<PlatformSettingEntity>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDefaults();
    } catch (err) {
      // The database may not be reachable during boot; migrations seed the same row.
      console.warn('Reputation defaults deferred:', (err as Error).message);
    }
  }

  private async ensureDefaults(): Promise<void> {
    const existing = await this.settings.findOne({ where: { key: 'max_prize_pool' } });
    if (!existing) {
      await this.settings.save(this.settings.create({ key: 'max_prize_pool', value: String(DEFAULT_GLOBAL_MAX_PRIZE_POOL), updatedBy: 'system' }));
    }
  }

  /** Platform-wide ceiling (never bypassable, not even by an exception). */
  async getGlobalMax(): Promise<number> {
    const row = await this.settings.findOne({ where: { key: 'max_prize_pool' } });
    const parsed = row ? Number(row.value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GLOBAL_MAX_PRIZE_POOL;
  }

  async setGlobalMax(value: number, updatedBy: string): Promise<number> {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('The platform maximum prize pool must be a positive amount.');
    }
    if (value > 10_000_000) {
      throw new BadRequestException('The platform maximum prize pool cannot exceed ₹1,00,00,000.');
    }
    await this.settings.upsert({ key: 'max_prize_pool', value: String(Math.round(value)), updatedBy }, ['key']);
    await this.auditLog.record('PLATFORM_PRIZE_CEILING_UPDATED', {
      actor: updatedBy,
      entityType: 'platform_setting',
      entityId: 'max_prize_pool',
      details: `Platform prize-pool ceiling set to ₹${Math.round(value).toLocaleString('en-IN')}.`,
      metadata: { value: Math.round(value) },
    });
    return Math.round(value);
  }

  /** Normalises a row that may predate the counter defaults (or was inserted directly). */
  private normalize(profile: OrganiserReputationEntity): OrganiserReputationEntity {
    (profile as any).qualifyingAbove50k = Number((profile as any).qualifyingAbove50k || 0);
    (profile as any).qualifyingAbove7k = Number((profile as any).qualifyingAbove7k || 0);
    (profile as any).qualifyingAbove5k = Number((profile as any).qualifyingAbove5k || 0);
    (profile as any).orangeRecoveryCount = Number((profile as any).orangeRecoveryCount || 0);
    (profile as any).paidOnTimeCount = Number((profile as any).paidOnTimeCount || 0);
    (profile as any).overduePaymentCount = Number((profile as any).overduePaymentCount || 0);
    (profile as any).mediumViolationCount = Number((profile as any).mediumViolationCount || 0);
    (profile as any).outstandingObligations = Number((profile as any).outstandingObligations || 0);
    (profile as any).banCount = Number((profile as any).banCount || 0);
    (profile as any).lifetimeBan = !!(profile as any).lifetimeBan;
    return profile;
  }

  async getOrCreate(username: string): Promise<OrganiserReputationEntity> {
    const existing = await this.reputation.findOne({ where: { username } });
    if (existing) return this.normalize(existing);
    const created = this.reputation.create({ username, level: 'blue' });
    try {
      return this.normalize(await this.reputation.save(created));
    } catch (err) {
      const raced = await this.reputation.findOne({ where: { username } });
      if (raced) return this.normalize(raced);
      throw err;
    }
  }

  private effectiveLimit(level: ReputationLevel, globalMax: number): number {
    return Math.min(REPUTATION_LEVEL_LIMITS[level], globalMax);
  }

  /** Full organiser reputation profile, including history and sanctions. */
  async getProfile(username: string) {
    const profile = await this.getOrCreate(username);
    const globalMax = await this.getGlobalMax();
    const [levelHistory, sanctionRows, pendingExceptions] = await Promise.all([
      this.history.find({ where: { username }, order: { createdAt: 'DESC' }, take: 50 }),
      this.sanctions.find({ where: { username }, order: { createdAt: 'DESC' }, take: 50 }),
      this.exceptions.find({ where: { organiserUsername: username }, order: { createdAt: 'DESC' }, take: 20 }),
    ]);
    const now = Date.now();
    const activeSanctions = sanctionRows.filter(
      (s) => s.active && (!s.endsAt || new Date(s.endsAt).getTime() > now) && !['formal_warning', 'final_warning'].includes(s.type),
    );
    return {
      username,
      level: profile.level,
      levelLabel: profile.level,
      limit: this.effectiveLimit(profile.level, globalMax),
      levelLimit: REPUTATION_LEVEL_LIMITS[profile.level],
      globalMax,
      counters: {
        qualifyingAbove50k: profile.qualifyingAbove50k,
        qualifyingAbove7k: profile.qualifyingAbove7k,
        qualifyingAbove5k: profile.qualifyingAbove5k,
        paidOnTimeCount: profile.paidOnTimeCount,
        overduePaymentCount: profile.overduePaymentCount,
        mediumViolationCount: profile.mediumViolationCount,
        outstandingObligations: profile.outstandingObligations,
        orangeRecoveryCount: profile.orangeRecoveryCount,
      },
      bannedUntil: profile.bannedUntil,
      banCount: profile.banCount,
      lifetimeBan: profile.lifetimeBan,
      activeSanctions,
      history: levelHistory,
      sanctions: sanctionRows,
      exceptions: pendingExceptions,
      updatedAt: profile.updatedAt,
    };
  }

  /** Throws when the organiser may not create/manage competitions right now. */
  async assertCanOrganise(username: string): Promise<OrganiserReputationEntity> {
    const profile = await this.getOrCreate(username);
    if (profile.lifetimeBan) {
      throw new ForbiddenException('This organiser is permanently banned from organising competitions.');
    }
    if (profile.bannedUntil && new Date(profile.bannedUntil).getTime() > Date.now()) {
      throw new ForbiddenException(
        `This organiser is serving a competition-creation ban until ${new Date(profile.bannedUntil).toISOString()}.`,
      );
    }
    const now = Date.now();
    const blocking = await this.sanctions.find({ where: { username, active: true } });
    const current = blocking.find(
      (s) =>
        ['creation_restriction', 'one_month_ban', 'lifetime_ban', 'competition_suspension'].includes(s.type) &&
        (!s.endsAt || new Date(s.endsAt).getTime() > now),
    );
    if (current) {
      throw new ForbiddenException(
        `A platform restriction is active on this account (${current.type.replace(/_/g, ' ')}): ${current.reason}`,
      );
    }
    return profile;
  }

  /**
   * Central prize-pool gate. Applies the reputation limit, the configurable
   * platform ceiling and (when needed) a single-use approved exception.
   */
  async authorizePrizePool(amount: number, username: string) {
    const profile = await this.getOrCreate(username);
    const globalMax = await this.getGlobalMax();
    const levelLimit = REPUTATION_LEVEL_LIMITS[profile.level];
    const limit = this.effectiveLimit(profile.level, globalMax);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Prize pool must be a valid, non-negative amount.');
    }
    if (amount > globalMax) {
      throw new BadRequestException(
        `The platform-wide maximum prize pool is ₹${globalMax.toLocaleString('en-IN')}. A competition cannot exceed this ceiling, even with an exception.`,
      );
    }
    if (amount <= limit) {
      return { level: profile.level, levelLimit, globalMax, limit, exceptionId: null as string | null };
    }

    const exception = await this.exceptions.findOne({
      where: { organiserUsername: username, status: 'approved', competitionId: IsNull() },
      order: { createdAt: 'ASC' },
    });
    if (exception && Number(exception.requestedAmount) >= amount) {
      return { level: profile.level, levelLimit, globalMax, limit, exceptionId: exception.id };
    }

    throw new BadRequestException(
      `Your current reputation level (${profile.level}) permits a maximum prize pool of ₹${limit.toLocaleString('en-IN')}. ` +
        `The platform maximum is ₹${globalMax.toLocaleString('en-IN')}. Request a prize-pool exception from an administrator to run a competition above your limit.`,
    );
  }

  /** Binds an approved single-use exception to the competition that used it. */
  async consumeException(exceptionId: string, competitionId: string, amount: number): Promise<void> {
    const result = await this.exceptions
      .createQueryBuilder()
      .update(PrizePoolExceptionEntity)
      .set({ competitionId })
      .where('id = :id AND status = :status AND "competitionId" IS NULL AND "requestedAmount" >= :amount', {
        id: exceptionId,
        status: 'approved',
        amount,
      })
      .execute();
    if (!result.affected) {
      throw new BadRequestException('The approved prize-pool exception is no longer available.');
    }
  }

  async requestException(username: string, requestedAmount: number, reason: string) {
    const globalMax = await this.getGlobalMax();
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Requested prize-pool amount must be a positive number.');
    }
    if (requestedAmount > globalMax) {
      throw new BadRequestException(`An exception can never exceed the platform maximum of ₹${globalMax.toLocaleString('en-IN')}.`);
    }
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Explain why the exception is needed (at least 10 characters).');
    }
    const record = await this.exceptions.save(
      this.exceptions.create({ organiserUsername: username, requestedAmount: Math.round(requestedAmount), reason: reason.trim(), status: 'pending' }),
    );
    await this.auditLog.record('PRIZE_EXCEPTION_REQUESTED', {
      actor: username,
      entityType: 'prize_pool_exception',
      entityId: record.id,
      details: `Requested a prize-pool exception for ₹${Math.round(requestedAmount).toLocaleString('en-IN')}.`,
      metadata: { requestedAmount },
    });
    return record;
  }

  async listExceptions(filter: { organiserUsername?: string; status?: string }) {
    const where: Record<string, any> = {};
    if (filter.organiserUsername) where.organiserUsername = filter.organiserUsername;
    if (filter.status) where.status = filter.status;
    return this.exceptions.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async reviewException(id: string, status: 'approved' | 'rejected', note: string, reviewer: string) {
    const record = await this.exceptions.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Prize-pool exception not found');
    if (record.status !== 'pending') throw new BadRequestException('This exception has already been reviewed.');
    const globalMax = await this.getGlobalMax();
    if (status === 'approved' && Number(record.requestedAmount) > globalMax) {
      throw new BadRequestException(`Cannot approve an amount above the platform maximum of ₹${globalMax.toLocaleString('en-IN')}.`);
    }
    record.status = status;
    record.reviewer = reviewer;
    record.reviewNote = note || null;
    const saved = await this.exceptions.save(record);
    await this.auditLog.record(status === 'approved' ? 'PRIZE_EXCEPTION_APPROVED' : 'PRIZE_EXCEPTION_REJECTED', {
      actor: reviewer,
      entityType: 'prize_pool_exception',
      entityId: id,
      details: `${status} ₹${Number(record.requestedAmount).toLocaleString('en-IN')} for @${record.organiserUsername}.`,
      metadata: { note: note || null },
    });
    await this.notifications
      .create({
        toUsername: record.organiserUsername,
        type: 'prize-pool-exception',
        title: status === 'approved' ? '✅ Prize-pool exception approved' : '❌ Prize-pool exception rejected',
        body: `Your request for ₹${Number(record.requestedAmount).toLocaleString('en-IN')} was ${status}. ${note || ''}`.trim(),
      })
      .catch(() => undefined);
    return saved;
  }

  /**
   * Applies the reputation transition rules from the platform policy.
   * Only recorded facts are evaluated — an unverified report never changes a level.
   */
  async evaluate(username: string, facts: ReputationFacts, reviewer: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrganiserReputationEntity);
      let profile = await repo.findOne({ where: { username }, lock: { mode: 'pessimistic_write' } });
      if (!profile) {
        profile = await repo.save(repo.create({ username, level: 'blue' }));
      }
      this.normalize(profile);

      const qualifying = Number(facts.qualifyingAmount || 0);
      if (qualifying >= QUALIFYING_THRESHOLDS.blueToGreen) profile.qualifyingAbove50k += 1;
      if (qualifying >= QUALIFYING_THRESHOLDS.orangeToBlue) profile.qualifyingAbove7k += 1;
      if (qualifying >= QUALIFYING_THRESHOLDS.redToOrange) profile.qualifyingAbove5k += 1;
      if (facts.paidOnTime) profile.paidOnTimeCount += 1;
      profile.overduePaymentCount += Number(facts.overduePayments || 0);
      profile.mediumViolationCount += Number(facts.mediumViolations || 0);
      if (facts.outstandingObligations !== undefined) {
        profile.outstandingObligations = Number(facts.outstandingObligations) || 0;
      }

      const previous = profile.level;
      let next: ReputationLevel = profile.level;
      let policy = '';
      let reason = facts.reason || 'Reputation evaluation';
      let sanction: { type: SanctionType; days?: number; reason: string } | null = null;

      const serious = !!facts.seriousMisconduct;
      const recoveryViolation = !!facts.failedPaymentDuringRecovery || !!facts.involvedInValidDispute;
      const banActive = profile.bannedUntil ? new Date(profile.bannedUntil).getTime() > Date.now() : false;

      if (profile.lifetimeBan) {
        // Nothing can lift a lifetime ban automatically.
        next = profile.level;
        policy = 'lifetime_ban_active';
      } else if (profile.level === 'red') {
        if (serious) {
          next = 'red';
          policy = 'serious_misconduct';
        } else if (banActive) {
          next = 'red';
          policy = 'ban_active';
        } else if (recoveryViolation) {
          next = 'red';
          if (profile.banCount > 0) {
            profile.lifetimeBan = true;
            policy = 'lifetime_ban_repeat';
            sanction = { type: 'lifetime_ban', reason: 'Repeat violation after a completed one-month organising ban.' };
          } else {
            profile.banCount += 1;
            profile.bannedUntil = new Date(Date.now() + RED_BAN_DAYS * 24 * 60 * 60 * 1000);
            policy = 'red_one_month_ban';
            sanction = { type: 'one_month_ban', days: RED_BAN_DAYS, reason: 'Failed to pay the prize pool or involved in a valid dispute during Red recovery.' };
          }
        } else if (
          profile.qualifyingAbove5k >= RECOVERY_COMPETITIONS_REQUIRED &&
          facts.paidOnTime &&
          profile.mediumViolationCount === 0 &&
          profile.outstandingObligations <= 0
        ) {
          next = 'orange';
          policy = 'red_to_orange_recovery';
          profile.qualifyingAbove5k = 0;
          profile.qualifyingAbove7k = 0;
          profile.overduePaymentCount = 0;
          profile.mediumViolationCount = 0;
        }
      } else if (serious) {
        next = 'red';
        policy = 'serious_misconduct';
      } else if (profile.level === 'blue') {
        if (profile.overduePaymentCount >= 2 || profile.mediumViolationCount >= 2) {
          next = profile.orangeRecoveryCount > 0 ? 'red' : 'orange';
          policy = profile.orangeRecoveryCount > 0 ? 'repeat_orange_after_recovery' : 'repeated_lower_severity';
        } else if (
          profile.qualifyingAbove50k > RECOVERY_COMPETITIONS_REQUIRED &&
          profile.paidOnTimeCount > 0 &&
          profile.overduePaymentCount === 0 &&
          profile.outstandingObligations <= 0
        ) {
          next = 'green';
          policy = 'blue_to_green';
        }
      } else if (profile.level === 'green') {
        if (profile.overduePaymentCount >= 2 || profile.mediumViolationCount >= 2) {
          next = 'orange';
          policy = 'green_downgrade';
          profile.qualifyingAbove7k = 0;
          profile.qualifyingAbove5k = 0;
        }
      } else if (profile.level === 'orange') {
        if (profile.orangeRecoveryCount > 0 && (profile.overduePaymentCount >= 2 || profile.mediumViolationCount >= 2)) {
          next = 'red';
          policy = 'repeat_orange_after_recovery';
        } else if (profile.overduePaymentCount >= 2 || profile.mediumViolationCount >= 2) {
          next = 'orange';
          policy = 'repeated_lower_severity';
        } else if (
          profile.qualifyingAbove7k >= RECOVERY_COMPETITIONS_REQUIRED &&
          facts.paidOnTime &&
          profile.mediumViolationCount === 0 &&
          profile.outstandingObligations <= 0
        ) {
          next = 'blue';
          policy = 'orange_to_blue_recovery';
          profile.orangeRecoveryCount += 1;
          profile.qualifyingAbove7k = 0;
          profile.overduePaymentCount = 0;
          profile.mediumViolationCount = 0;
        }
      }

      profile.level = next;
      await repo.save(profile);

      if (sanction) {
        await manager.getRepository(OrganiserSanctionEntity).save(
          manager.getRepository(OrganiserSanctionEntity).create({
            username,
            type: sanction.type,
            reason: sanction.reason,
            reportId: facts.reportId || null,
            appliedBy: reviewer,
            startsAt: new Date(),
            endsAt: sanction.days ? new Date(Date.now() + sanction.days * 24 * 60 * 60 * 1000) : null,
            active: true,
          }),
        );
      }

      if (next !== previous) {
        await manager.getRepository(OrganiserReputationHistoryEntity).save(
          manager.getRepository(OrganiserReputationHistoryEntity).create({
            username,
            fromLevel: previous,
            toLevel: next,
            reason,
            policy: policy || null,
            reportId: facts.reportId || null,
            reviewer,
          }),
        );
      }

      return { username, previousLevel: previous, level: next, policy, reason, profile };
    });

    if (result.previousLevel !== result.level) {
      await this.auditLog.record('ORGANISER_REPUTATION_CHANGED', {
        actor: reviewer,
        entityType: 'organiser_reputation',
        entityId: result.username,
        details: `@${result.username}: ${result.previousLevel} → ${result.level} (${result.policy || 'policy'}). ${result.reason}`,
        metadata: { from: result.previousLevel, to: result.level, policy: result.policy, reportId: (facts as any).reportId || null },
      });
      await this.notifications
        .create({
          toUsername: result.username,
          type: 'reputation-changed',
          title: `Organiser reputation: ${result.level.toUpperCase()}`,
          body: `Your organiser reputation changed from ${result.previousLevel} to ${result.level}. ${result.reason}`,
        })
        .catch(() => undefined);
    }

    return {
      username: result.username,
      previousLevel: result.previousLevel,
      level: result.level,
      policy: result.policy,
      limit: this.effectiveLimit(result.level, await this.getGlobalMax()),
    };
  }

  /** Direct downgrade recorded by a community moderator decision. */
  async applyDowngrade(
    username: string,
    targetLevel: ReputationLevel,
    reason: string,
    reportId: string | null,
    reviewer: string,
  ) {
    if (!isReputationLevel(targetLevel)) throw new BadRequestException('Unknown reputation level.');
    const profile = await this.getOrCreate(username);
    if (levelRank(targetLevel) <= levelRank(profile.level)) {
      throw new BadRequestException(
        `A downgrade must move the organiser to a lower level (current: ${profile.level}, requested: ${targetLevel}).`,
      );
    }
    const previous = profile.level;
    profile.level = targetLevel;
    if (targetLevel === 'red') profile.banCount = profile.banCount;
    await this.reputation.save(profile);
    await this.history.save(
      this.history.create({ username, fromLevel: previous, toLevel: targetLevel, reason, policy: 'moderator_decision', reportId, reviewer }),
    );
    await this.auditLog.record('ORGANISER_REPUTATION_DOWNGRADED', {
      actor: reviewer,
      entityType: 'organiser_reputation',
      entityId: username,
      details: `@${username}: ${previous} → ${targetLevel}. ${reason}`,
      metadata: { reportId },
    });
    await this.notifications
      .create({
        toUsername: username,
        type: 'reputation-changed',
        title: `Organiser reputation downgraded to ${targetLevel.toUpperCase()}`,
        body: reason,
      })
      .catch(() => undefined);
    return this.getProfile(username);
  }

  /** Records a sanction and enforces its effects (ban window / lifetime ban). */
  async issueSanction(
    username: string,
    type: SanctionType,
    reason: string,
    options: { reportId?: string | null; days?: number; appliedBy: string },
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A sanction reason is required.');
    }
    const profile = await this.getOrCreate(username);
    const endsAt = options.days ? new Date(Date.now() + options.days * 24 * 60 * 60 * 1000) : null;
    const sanction = await this.sanctions.save(
      this.sanctions.create({
        username,
        type,
        reason: reason.trim(),
        reportId: options.reportId || null,
        appliedBy: options.appliedBy,
        startsAt: new Date(),
        endsAt,
        active: true,
      }),
    );
    if (type === 'one_month_ban') {
      profile.bannedUntil = endsAt;
      profile.banCount += 1;
      await this.reputation.save(profile);
    }
    if (type === 'lifetime_ban') {
      profile.lifetimeBan = true;
      await this.reputation.save(profile);
    }
    if (['formal_warning', 'final_warning'].includes(type)) {
      await this.notifications
        .create({
          toUsername: username,
          type: `organiser-${type}`,
          title: type === 'final_warning' ? 'Final warning (organiser)' : 'Formal warning (organiser)',
          body: reason,
        })
        .catch(() => undefined);
    }
    await this.auditLog.record('ORGANISER_SANCTION_APPLIED', {
      actor: options.appliedBy,
      entityType: 'organiser_sanction',
      entityId: sanction.id,
      details: `${type} applied to @${username}. ${reason}`,
      metadata: { reportId: options.reportId || null, days: options.days || null },
    });
    return sanction;
  }

  async getHistory(username: string) {
    const [reputationHistory, sanctionRows] = await Promise.all([
      this.history.find({ where: { username }, order: { createdAt: 'DESC' } }),
      this.sanctions.find({ where: { username }, order: { createdAt: 'DESC' } }),
    ]);
    return { reputationHistory, sanctions: sanctionRows };
  }
}
