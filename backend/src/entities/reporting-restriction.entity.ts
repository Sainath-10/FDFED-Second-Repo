import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Per-player, per-competition discarded-report counter. The row is locked
 * during submission so concurrent requests cannot bypass the limit.
 */
@Entity('reporting_restrictions')
@Index(['competitionId', 'username'], { unique: true })
export class ReportingRestrictionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @Column()
  username: string;

  @Column({ default: 0 })
  discardedCount: number;

  @Column({ default: false })
  restricted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
