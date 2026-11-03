import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Server-side audit trail for important workflow actions:
 * roster changes, disbands, refund requests/results, scheduling and disputes.
 *
 * Never log tokens, passwords or other sensitive credentials here.
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

  @Column({ nullable: true })
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
