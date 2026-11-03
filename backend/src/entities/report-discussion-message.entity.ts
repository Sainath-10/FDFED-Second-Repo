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

  @Column({ type: 'simple-array', default: '' })
  evidenceUrls: string[];

  @CreateDateColumn()
  createdAt: Date;
}
