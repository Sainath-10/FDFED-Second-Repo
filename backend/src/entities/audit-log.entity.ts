import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Server-side audit trail for important workflow actions:
 * roster changes, disbands, refund requests/results, scheduling,
 * verification events and disputes.
 *
 * Never log Aadhaar numbers, OTPs, tokens or other sensitive identity data here.
 */
@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** logical action, e.g. TEAM_MEMBER_REMOVED, TEAM_DISBAND, MATCH_RESULT_RECORDED */
  @Column()
  actionType: string;

  @Column({ nullable: true })
  actor: string;

  @Column({ name: 'entity_type', nullable: true })
  entityType: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'text', nullable: true, default: null })
  details: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
