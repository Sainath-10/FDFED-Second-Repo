import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ChatChannel = 'announcements' | 'general' | 'team';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @Column({ nullable: true })
  teamId: string | null;

  @Column({ type: 'varchar', length: 16 })
  channel: ChatChannel;

  @Column({ type: 'varchar', length: 100 })
  authorUsername: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
