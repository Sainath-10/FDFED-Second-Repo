import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('report_status_history')
export class ReportStatusHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reportId: string;

  @Column({ type: 'varchar', nullable: true })
  fromStatus: string;

  @Column({ type: 'varchar' })
  toStatus: string;

  @Column({ nullable: true })
  actor: string;

  @Column({ type: 'text', nullable: true, default: null })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
