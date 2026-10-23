import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persisted refund request created by the team-disband workflow.
 *
 * NOTE: The platform has no automatic payment-provider refunds implemented yet.
 * A refund request is recorded as 'pending' — money is NEVER marked as refunded
 * until an authorized support/admin confirms it. Idempotency is enforced with a
 * unique `refundKey` so repeated disband/refund calls cannot create duplicates.
 */
@Entity('refund_requests')
export class RefundRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  refundKey: string;

  @Column()
  competitionId: string;

  @Column({ nullable: true })
  competitionName: string;

  @Column({ nullable: true })
  teamId: string;

  @Column({ nullable: true })
  teamName: string;

  @Column()
  username: string;

  @Column({ type: 'float', nullable: true })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ default: 'pending' }) // pending | completed | failed | cancelled
  status: string;

  @Column({ type: 'text', nullable: true, default: null })
  statusNote: string;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ nullable: true })
  requestedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
