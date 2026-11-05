import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Append-only audit trail for report decisions, discussions and access changes. */
@Entity('report_audit_logs')
export class ReportAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  reportId: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  actor: string;

  @Column({ type: 'text', nullable: true, default: null })
  details: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
