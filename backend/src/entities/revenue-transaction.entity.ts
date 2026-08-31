import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('revenue_transactions')
export class RevenueTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  competitionId: string;

  @Column({ nullable: true })
  competitionName: string;

  @Column({ nullable: true })
  organizerName: string;

  @Column({ type: 'float', default: 0 })
  grossAmount: number;

  @Column({ type: 'float', default: 0 })
  platformFee: number;

  @Column({ type: 'float', default: 0 })
  netPayout: number;

  @Column({ default: 'CONFIRMED' })
  status: string; // CONFIRMED | PENDING | FAILED

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
