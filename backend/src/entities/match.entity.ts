import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchResultDetails } from '../common/tournament/match-rules';

export type StoredParticipantSlot = { teamId: string | null; seed: number | null; sourceMatchId?: string; bye?: boolean };
export type StoredBracket = {
  kind?: 'ipl'; loserMatchId?: string; loserSlot?: 1 | 2;
  key: string; version?: number; round?: number; position?: number; bracketSize?: number; roundCount?: number;
  slots?: [StoredParticipantSlot, StoredParticipantSlot];
  nextMatchId?: string | null; nextSlot?: 1 | 2 | null;
  source1?: string; source2?: string; bye1?: boolean; bye2?: boolean;
};

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
  status: string; // pending | ready | scheduled | ongoing | completed | bye

  @Column({ nullable: true, type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ default: 60 })
  durationMinutes: number;

  @Column({ type: 'jsonb', nullable: true })
  bracket: StoredBracket;

  @Column({ default: 'standard' })
  resultRule: string;

  @Column({ type: 'jsonb', nullable: true })
  resultDetails: MatchResultDetails;

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
