import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('teams')
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  competitionId: string;

  @Column()
  leaderId: string; // username

  @Column({ default: 'pending' })
  status: string; // pending | approved | rejected | banned

  @Column({ nullable: true })
  statusUpdatedBy: string;

  @Column({ nullable: true, type: 'timestamptz' })
  statusUpdatedAt: Date;

  @Column({ default: 0 })
  warningsCount: number;

  /** Comma-separated list of member usernames */
  @Column({ type: 'simple-array', default: '' })
  memberUsernames: string[];

  @Column({ nullable: true })
  createdBy: string; // same as leaderId usually

  @Column({ nullable: true })
  leaderUsername: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
