import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('report_discussion_messages')
export class ReportDiscussionMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  discussionId: string;

  @Column()
  authorUsername: string;

  @Column({ type: 'text' })
  body: string;

  /**
   * Attachments with their file details. jsonb, not simple-array: evidence is
   * usually a data URL ("data:image/jpeg;base64,…"), and simple-array splits on
   * commas, which cut every image in two. The legacy "evidenceUrls" column is
   * no longer mapped.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence: { url: string; filename: string; mimetype: string; size: number }[];

  @CreateDateColumn()
  createdAt: Date;
}
