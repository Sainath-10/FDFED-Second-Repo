import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AuditLogEntity } from '../../entities/audit-log.entity';

export interface AuditOptions {
  actor?: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  metadata?: Record<string, any>;
  /** Write inside the caller's transaction, so the change and its audit row commit together. */
  manager?: EntityManager;
}

type PendingEvent = { actionType: string; actor: string; entityType?: string; entityId?: string; details?: string; metadata: Record<string, any>; at: string };

const OUTBOX_FILE = path.join(process.cwd(), 'logs', 'audit-outbox.jsonl');
const RETRY_MS = 30_000;

/**
 * The platform's central activity log (§14).
 *
 * Every important action is written to `audit_logs`. A failed write never
 * breaks the action itself, but it is not dropped either: the event goes to a
 * local outbox file and is retried until it is stored, keeping its original
 * timestamp. Callers that change data in a transaction pass `manager` so the
 * audit row is part of the same commit.
 *
 * NEVER record identity document numbers, OTPs, tokens, passwords or other
 * sensitive identity data here.
 */
@Injectable()
export class AuditLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditLogService.name);
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => { this.flushOutbox().catch(() => undefined); }, RETRY_MS);
    if (this.timer.unref) this.timer.unref();
    this.flushOutbox().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async record(actionType: string, options: AuditOptions = {}): Promise<void> {
    const event: PendingEvent = {
      actionType,
      actor: options.actor || 'system',
      entityType: options.entityType,
      entityId: options.entityId != null ? String(options.entityId) : undefined,
      details: options.details,
      metadata: options.metadata || {},
      at: new Date().toISOString(),
    };
    if (options.manager) {
      // Inside a transaction: let a failure roll the whole change back.
      await this.write(event, options.manager.getRepository(AuditLogEntity));
      return;
    }
    try {
      await this.write(event, this.repo);
    } catch (err) {
      // Audit must never break the primary workflow, but the event is kept.
      this.logger.warn(`Audit write for ${actionType} failed, queued for retry: ${(err as Error).message}`);
      this.enqueue(event);
    }
  }

  private async write(event: PendingEvent, repo: Repository<AuditLogEntity>) {
    await repo.save(repo.create({
      actionType: event.actionType,
      actor: event.actor,
      entityType: event.entityType,
      entityId: event.entityId,
      details: event.details,
      metadata: event.metadata,
      createdAt: new Date(event.at),
    }));
  }

  private enqueue(event: PendingEvent) {
    try {
      fs.mkdirSync(path.dirname(OUTBOX_FILE), { recursive: true });
      fs.appendFileSync(OUTBOX_FILE, `${JSON.stringify(event)}\n`, 'utf8');
    } catch (err) {
      this.logger.error(`Audit event ${event.actionType} could not be queued: ${(err as Error).message}`);
    }
  }

  /** Retries queued events in order; whatever still fails stays queued. */
  async flushOutbox(): Promise<number> {
    if (this.flushing || !fs.existsSync(OUTBOX_FILE)) return 0;
    this.flushing = true;
    try {
      const working = `${OUTBOX_FILE}.${process.pid}.flushing`;
      fs.renameSync(OUTBOX_FILE, working);
      const lines = fs.readFileSync(working, 'utf8').split('\n').filter(Boolean);
      let stored = 0;
      for (const line of lines) {
        let event: PendingEvent;
        try { event = JSON.parse(line); } catch { continue; }
        try {
          await this.write(event, this.repo);
          stored += 1;
        } catch {
          this.enqueue(event);
        }
      }
      fs.unlinkSync(working);
      if (stored) this.logger.log(`Stored ${stored} queued audit event(s).`);
      return stored;
    } catch (err) {
      this.logger.warn(`Audit outbox flush failed: ${(err as Error).message}`);
      return 0;
    } finally {
      this.flushing = false;
    }
  }
}
