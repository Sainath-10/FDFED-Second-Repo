import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ReputationLevel } from '../common/reporting';

/**
 * Current organiser reputation plus the counters the transition rules read.
 * Every change also writes an OrganiserReputationHistoryEntity row.
 */
@Entity('organiser_reputation')
export class OrganiserReputationEntity {
  @PrimaryColumn({ type: 'varchar' })
  username: string;

  @Column({ type: 'varchar', default: 'blue' })
  level: ReputationLevel;

  /** Counters are maintained from recorded qualifying tournaments. */
  @Column({ default: 0 })
  qualifyingAbove50k: number;

  @Column({ default: 0 })
  qualifyingAbove7k: number;

  @Column({ default: 0 })
  qualifyingAbove5k: number;

  /** How often the organiser recovered Orange → Blue (a second Orange escalates to Red). */
  @Column({ default: 0 })
  orangeRecoveryCount: number;

  @Column({ default: 0 })
  paidOnTimeCount: number;

  @Column({ default: 0 })
  overduePaymentCount: number;

  @Column({ default: 0 })
  mediumViolationCount: number;

  @Column({ type: 'float', default: 0 })
  outstandingObligations: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  bannedUntil: Date | null;

  @Column({ default: 0 })
  banCount: number;

  @Column({ default: false })
  lifetimeBan: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
