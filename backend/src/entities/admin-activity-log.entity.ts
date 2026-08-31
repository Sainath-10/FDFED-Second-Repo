import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('admin_activity_logs')
export class AdminActivityLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'admin@nexus.gg' })
  adminUsername: string;

  @Column()
  actionType: string; // REVENUE_CONFIG_CHANGE | DISPUTE_RESOLVED | COMPETITION_APPROVAL

  @Column({ type: 'text' })
  details: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}
