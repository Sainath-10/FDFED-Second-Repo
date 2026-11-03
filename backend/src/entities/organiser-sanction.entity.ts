import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { SanctionType } from '../common/reporting';

@Entity('organiser_sanctions')
export class OrganiserSanctionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column({ type: 'varchar' })
  type: SanctionType;

  @Column({ type: 'text' })
  reason: string;

  @Column({ nullable: true })
  reportId: string;

  @Column({ nullable: true })
  appliedBy: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startsAt: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  endsAt: Date | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
