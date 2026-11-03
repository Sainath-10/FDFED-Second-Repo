import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('payment_mail')
export class PaymentMailEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) eventKey: string;
  @Column('uuid') competitionId: string;
  @Column() username: string;
  @Column() template: string;
  @Column() subject: string;
  @Column('text') body: string;
  @Column({ default: 'MOCK_DELIVERED' }) status: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
