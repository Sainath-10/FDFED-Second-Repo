import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('report_discussion_participants')
@Index(['discussionId', 'username'], { unique: true })
export class ReportDiscussionParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  discussionId: string;

  @Column()
  username: string;

  /** reviewer | reporter | accused | witness */
  @Column({ type: 'varchar', default: 'participant' })
  role: string;

  @Column({ nullable: true })
  addedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
