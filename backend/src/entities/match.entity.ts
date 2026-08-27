import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('matches')
export class MatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @Column({ nullable: true })
  team1Id: string;

  @Column({ nullable: true })
  team2Id: string;

  @Column({ nullable: true })
  team1Name: string;

  @Column({ nullable: true })
  team2Name: string;

  @Column({ nullable: true })
  winnerId: string;

  @Column({ nullable: true })
  winnerName: string;

  @Column({ nullable: true })
  score: string;

  @Column({ default: 'scheduled' })
  status: string; // scheduled | ongoing | completed

  @Column({ nullable: true, type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ nullable: true })
  round: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
