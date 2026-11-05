import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/** Simple key/value platform configuration (e.g. the global prize-pool ceiling). */
@Entity('platform_settings')
export class PlatformSettingEntity {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ nullable: true })
  updatedBy: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
