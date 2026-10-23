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

  @Column({ name: 'password_hash', select: false, default: '' })
  passwordHash: string;

  @Column({ type: 'varchar', default: UserRole.PARTICIPANT })
  role: UserRole;

  @Column({ name: 'adminType', type: 'varchar', nullable: true, default: null })
  adminType: string | null;

  @Column({ name: 'revokedReason', type: 'text', nullable: true, default: null })
  revokedReason: string | null;

  @Column({ default: false })
  banned: boolean;

  @Column({ name: 'warningCount', default: 0 })
  warningCount: number;

  @Column({ name: 'profilePicUrl', nullable: true, type: 'text' })
  profilePicUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  /**
   * Mock verification status ('unverified' | 'verified').
   * NOTE: This is a simulated workflow flag, NOT real UIDAI/KYC proof of identity.
   * It is used to gate competition create/join workflows.
   */
  @Column({ name: 'verificationStatus', type: 'varchar', default: 'unverified' })
  verificationStatus: string;

  @Column({ name: 'verifiedAt', type: 'timestamptz', nullable: true, default: null })
  verifiedAt: Date | null;

  /** Masked representation only (e.g. XXXX XXXX 1234) — the full Aadhaar number is never stored, logged or sent anywhere. */
  @Column({ name: 'aadhaarMasked', type: 'varchar', nullable: true, default: null })
  aadhaarMasked: string | null;

  /**
   * Requires mock verification before publishing a competition (§13.1).
   * Same mock flag as verificationStatus; separate column so organizer-specific
   * product rules can diverge from participant verification later.
   */
  @Column({ name: 'organizerVerificationStatus', type: 'varchar', default: 'unverified' })
  organizerVerificationStatus: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
