import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Immutable audit trail of reputation transitions. */
@Entity('organiser_reputation_history')
export class OrganiserReputationHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column({ type: 'varchar', nullable: true })
  fromLevel: string;

  @Column({ type: 'varchar' })
  toLevel: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  policy: string;

  @Column({ nullable: true })
  reportId: string;

  @Column({ nullable: true })
  reviewer: string;

  @CreateDateColumn()
  createdAt: Date;
}
