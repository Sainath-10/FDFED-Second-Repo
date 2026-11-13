import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ReportAction, ReportFinding, ReportPriority, ReportQueue, ReportStatus } from '../common/reporting';

/**
 * A report is an allegation, not proof. No status transition applies a
 * punishment automatically — only a recorded reviewer decision does.
 */
@Entity('reports')
@Index(['queue', 'status'])
@Index(['competitionId', 'reporterUsername'])
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @Column({ nullable: true })
  matchId: string;

  @Column()
  reporterUsername: string;

  @Column({ type: 'varchar', default: 'participant' })
  reporterRole: string;

  @Column({ nullable: true })
  reporterTeamId: string;

  @Column()
  reportedUsername: string;

  /** participant role of the accused at submission time: player | team_leader | organiser */
  @Column({ type: 'varchar' })
  reportedRole: string;

  @Column({ nullable: true })
  reportedTeamId: string;

  /** First-level handler per the responsibility matrix (team_leader | organiser | moderator). */
  @Column({ type: 'varchar', default: 'organiser' })
  firstLevel: string;

  @Column({ type: 'varchar' })
  reasonCode: string;

  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'varchar', default: 'medium' })
  priority: ReportPriority;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  incidentAt: Date | null;

  @Column({ nullable: true })
  sourcePage: string;

  @Column({ type: 'varchar', default: 'new' })
  status: ReportStatus;

  @Column({ type: 'varchar' })
  queue: ReportQueue;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  finding: ReportFinding | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  action: ReportAction | null;

  @Column({ type: 'text', nullable: true, default: null })
  conclusion: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  discardReason: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  discardNote: string | null;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  resolvedAt: Date | null;

  @Column({ nullable: true })
  relatedReportId: string;

  /** Set when this report is a complaint about an organiser's decision. */
  @Column({ nullable: true })
  originalReportId: string;

  /** The decision being complained about, captured when the complaint is filed. */
  @Column({ type: 'text', nullable: true, default: null })
  originalDecision: string | null;

  /** null | submitted | resolved — an organiser decision can be appealed once. */
  @Column({ type: 'varchar', nullable: true, default: null })
  appealStatus: string | null;

  @Column({ default: 0 })
  appealCount: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  appealedAt: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  appealDiscussionId: string | null;

  @Column({ default: false })
  uplifted: boolean;

  @Column({ type: 'text', nullable: true, default: null })
  upliftReason: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  upliftedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  upliftedAt: Date | null;

  /** After uplifting a suspension: reopen | remain_terminated. */
  @Column({ type: 'varchar', nullable: true, default: null })
  competitionDisposition: string | null;

  /** Every decision recorded on this report, oldest first; the last one is current. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  decisionHistory: Array<Record<string, any>>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
