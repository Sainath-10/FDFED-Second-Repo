import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
@Entity('escrow_accounts')
export class EscrowAccountEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) competitionId: string;
  @Column({ default: 0 }) prizeMinor: number;
  @Column({ default: 0 }) registrationsMinor: number;
  @Column({ default: 0 }) payoutsMinor: number;
  @Column({ default: 0 }) refundsMinor: number;
  @Column({ default: 0 }) balanceMinor: number;
  @Column({ default: 'OPEN' }) status: string;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
