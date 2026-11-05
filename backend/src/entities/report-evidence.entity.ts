import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Evidence is write-once: the API never updates or deletes an evidence row. */
@Entity('report_evidence')
export class ReportEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reportId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ nullable: true })
  filename: string;

  @Column({ type: 'varchar', nullable: true })
  mimetype: string;

  @Column({ type: 'int', default: 0 })
  sizeBytes: number;

  @Column()
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
