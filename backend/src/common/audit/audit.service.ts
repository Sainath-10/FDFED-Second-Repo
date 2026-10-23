import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/audit-log.entity';

/**
 * Records important workflow actions server-side (§14).
 * NEVER record Aadhaar numbers, OTPs, tokens or sensitive identity data here.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async record(
    actionType: string,
    options: { actor?: string; entityType?: string; entityId?: string; details?: string; metadata?: Record<string, any> } = {},
  ): Promise<void> {
    try {
      await this.repo.save(this.repo.create({
        actionType,
        actor: options.actor || 'system',
        entityType: options.entityType,
        entityId: options.entityId,
        details: options.details,
        metadata: options.metadata || {},
      }));
    } catch (err) {
      // Audit must never break the primary workflow.
      this.logger.warn(`Failed to write audit event ${actionType}: ${(err as Error).message}`);
    }
  }
}
