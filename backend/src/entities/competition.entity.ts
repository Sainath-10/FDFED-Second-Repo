import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('competitions')
export class CompetitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ default: 'active' })
  status: string; // draft | active | completed

  @Column()
  createdBy: string; // username

  @Column({ type: 'simple-array', default: '' })
  organizers: string[];

  @Column({ nullable: true })
  game: string;

  @Column({ nullable: true })
  type: string; // tournament | league

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  prizePool: string;

  @Column({ nullable: true })
  format: string;

  @Column({ nullable: true })
  season: string;

  @Column({ default: 0 })
  maxTeams: number;

  @Column({ nullable: true })
  bannerColor: string;

  @Column({ default: 'approved' })
  approvalStatus: string; // pending | approved | rejected

  @Column({ nullable: true })
  approvalUpdatedBy: string;

  @Column({ nullable: true, type: 'timestamptz' })
  approvalUpdatedAt: Date;

  @Column({ nullable: true, type: 'float' })
  platformFee: number;

  @Column({ nullable: true })
  feeType: string;

  @Column({ nullable: true, type: 'float' })
  entryFeeAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
