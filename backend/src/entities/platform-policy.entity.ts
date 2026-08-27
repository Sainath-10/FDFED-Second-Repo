import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_policies')
export class PlatformPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  version: string;

  @Column({ default: true })
  active: boolean;

  @Column()
  createdBy: string;

  @Column({ nullable: true, type: 'float' })
  compliance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
