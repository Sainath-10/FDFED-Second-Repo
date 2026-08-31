import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../common/interfaces';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column({ default: '' })
  firstName: string;

  @Column({ default: '' })
  lastName: string;

  @Column({ name: 'password_hash', select: false, default: '' })
  passwordHash: string;

  @Column({ type: 'varchar', default: UserRole.PARTICIPANT })
  role: UserRole;

  @Column({ default: false })
  banned: boolean;

  @Column({ default: 0 })
  warningCount: number;

  @Column({ nullable: true, type: 'text' })
  profilePicUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
