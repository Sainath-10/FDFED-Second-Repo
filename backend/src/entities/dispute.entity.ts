import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DisputeStatus, DisputeTargetType } from '../common/interfaces';

@Entity('disputes')
export class DisputeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @Column({ nullable: true })
  matchId: string;

  @Column({ nullable: true })
  teamId: string;

  @Column()
  reportedBy: string;

  @Column({ type: 'simple-array', default: '' })
  organizers: string[];

  @Column({ type: 'varchar' })
  targetType: DisputeTargetType;

  @Column({ nullable: true })
  targetUserOrTeam: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'simple-array', default: '' })
  evidenceUrls: string[];

  @Column({ type: 'varchar', default: DisputeStatus.OPEN_ORGANIZER })
  status: DisputeStatus;

  @Column({ nullable: true, type: 'text' })
  organizerNotes: string;

  @Column({ nullable: true, type: 'text' })
  adminNotes: string;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ default: false })
  banRequested: boolean;

  @Column({ default: false })
  banApplied: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
