import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('team_join_requests')
export class TeamJoinRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  teamId: string;

  @Column()
  competitionId: string;

  @Column()
  fromUsername: string;

  @Column({ default: 'pending' })
  status: string; // pending | accepted | rejected

  @Column({ nullable: true, type: 'text' })
  message: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
