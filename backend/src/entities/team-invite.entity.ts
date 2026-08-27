import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('team_invites')
export class TeamInviteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  teamId: string;

  @Column()
  competitionId: string;

  @Column()
  toUsername: string;

  @Column()
  fromUsername: string;

  @Column({ default: 'pending' })
  status: string; // pending | accepted | rejected

  @CreateDateColumn()
  createdAt: Date;
}
