import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Single-use prize-pool exception. Approved requests never change the
 * organiser's reputation or permanent limit; they are consumed by one
 * competition and cannot exceed the platform ceiling.
 */
@Entity('prize_pool_exceptions')
export class PrizePoolExceptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organiserUsername: string;

  @Column({ nullable: true })
  competitionId: string;

  @Column({ type: 'float' })
  requestedAmount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: string; // pending | approved | rejected

  @Column({ nullable: true })
  reviewer: string;

  @Column({ type: 'text', nullable: true, default: null })
  reviewNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
