import { Injectable, BadRequestException } from '@nestjs/common';
import { UserRepository } from '../auth/repositories/user.repository';
import { AuditLogService } from '../../common/audit/audit.service';

/**
 * MOCK AADHAAR VERIFICATION (§12) — SIMULATED, labelled as such everywhere.
 *
 * - Step 1 (requestOtp): validates the 12-digit FORMAT only. A 12-digit format
 *   check does not prove that a number is authentic or belongs to the user.
 * - Step 2 (verify): accepts any non-empty OTP — identity is NOT established.
 * - The full Aadhaar number is never stored/logged/sent anywhere; only a masked
 *   representation (XXXX XXXX <last4>) may be persisted. OTP values are never
 *   persisted.
 * - This is an application workflow flag, not a security boundary against fraud.
 *   A compliant identity-verification provider can replace this flow later: the
 *   provider-specific logic is isolated to this service.
 */
@Injectable()
export class VerificationService {
  constructor(
    private userRepository: UserRepository,
    private auditLog: AuditLogService,
  ) {}

  private maskAadhaar(digits: string): string {
    // keep last 4 digits only; masked representation, full number never stored
    return `XXXX XXXX ${digits.slice(-4)}`;
  }

  async getStatus(userId: string, username: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) userNotFound();
    return {
      // For organizers, the organizer-specific flag applies; base status for participants.
      verificationStatus: user.verificationStatus,
      organizerVerificationStatus: user.organizerVerificationStatus || user.verificationStatus,
      verifiedAt: user.verifiedAt,
      aadhaarMasked: user.aadhaarMasked,
      simulated: true,
    };
  }

  async requestOtp(userId: string, aadhaarNumber: string) {
    const clean = String(aadhaarNumber || '').replace(/\D/g, '');
    if (clean.length !== 12) {
      throw new BadRequestException('Please enter a valid 12-digit Aadhaar number.');
    }
    const user = await this.userRepository.findById(userId);
    if (!user) userNotFound();

    // Simulated step: an actual UIDAI integration would initiate the OTP here.
    // We deliberately do NOT generate, send, or store any OTP.
    await this.auditLog.record('VERIFICATION_OTP_REQUESTED', {
      actor: user.username,
      entityType: 'user',
      entityId: user.id,
      details: 'Simulated Aadhaar OTP step initiated (12-digit format validated only).',
      // metadata intentionally excludes the Aadhaar number
    });

    return {
      ok: true,
      simulated: true,
      message: 'Format validated. Mock verification: enter any non-empty OTP to complete the simulated flow. This is NOT real UIDAI verification.',
      masked: this.maskAadhaar(clean),
    };
  }

  async verify(userId: string, otp: string) {
    const clean = String(otp || '').trim();
    if (!clean) {
      throw new BadRequestException('Please enter the OTP to complete verification.');
    }
    if (clean.length > 10) {
      throw new BadRequestException('OTP format is invalid.');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) userNotFound();
    if (user.verificationStatus === 'verified') {
      return { ok: true, alreadyVerified: true, verificationStatus: 'verified' };
    }

    // Any non-empty OTP completes the SIMULATED flow. No real authentication.
    const updated = await this.userRepository.update(userId, {
      verificationStatus: 'verified',
      organizerVerificationStatus: 'verified',
      verifiedAt: new Date(),
    } as any);

    await this.auditLog.record('ACCOUNT_VERIFIED_MOCK', {
      actor: user.username,
      entityType: 'user',
      entityId: user.id,
      details: 'Simulated Aadhaar verification completed (mock flow; not real KYC).',
    });

    return {
      ok: true,
      simulated: true,
      verificationStatus: 'verified',
      verifiedAt: (updated as any)?.verifiedAt || new Date(),
      message: 'Verification complete (simulated).',
    };
  }
}

function userNotFound(): never {
  throw new BadRequestException('Authenticated user no longer exists.');
}
