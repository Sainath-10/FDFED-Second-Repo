import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('revenue_configs')
export class RevenueConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float', default: 7 })
  percentage: number;

  @Column({ type: 'float', default: 50 })
  minCost: number;

  @Column({ nullable: true })
  updatedBy: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
