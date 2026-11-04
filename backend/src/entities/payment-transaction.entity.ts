import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payment_transactions')
@Index(['competitionId', 'type', 'subjectKey'], { unique: true })
export class PaymentTransactionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') competitionId: string;
  @Column() userUsername: string;
  @Column() type: string;
  @Column({ default: '' }) subjectKey: string;
  @Column({ nullable: true }) teamId: string;
  @Column({ default: 'IN' }) direction: string;
  // Integer paise avoids floating point arithmetic for collected money.
  @Column('integer') amountMinor: number;
  @Column({ default: 'INR' }) currency: string;
  @Column({ default: 'PENDING' }) status: string;
  @Column({ nullable: true, unique: true }) gatewayOrderId: string;
  @Column({ nullable: true, unique: true }) gatewayRefId: string;
  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
