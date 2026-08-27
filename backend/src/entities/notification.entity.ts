import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  toUsername: string;

  @Column()
  type: string;

  @Column({ default: 'pending' })
  status: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'json', nullable: true })
  meta: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
