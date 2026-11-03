import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Controlled case discussion room — not a general group chat. */
@Entity('report_discussions')
export class ReportDiscussionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reportId: string;

  @Column({ type: 'varchar', default: 'open' })
  status: string; // open | ended

  @Column()
  createdBy: string;

  @Column({ nullable: true })
  endedBy: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  endedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
