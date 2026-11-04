import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * A player removed from a competition by a recorded organiser decision.
 *
 * Participation is revoked from this record: every competition/team API checks
 * it against the current database state, so an old URL or cached session cannot
 * restore access. The global account is never deleted.
 */
@Entity('competition_removals')
@Index(['competitionId', 'username'], { unique: true })
export class CompetitionRemovalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  removedBy: string;

  @Column({ nullable: true })
  reportId: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
