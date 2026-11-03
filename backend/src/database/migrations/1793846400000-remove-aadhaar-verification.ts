import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEXUS ESPORTS — remove the retired Aadhaar verification feature.
 *
 * The application no longer reads or writes identity-verification status. The
 * columns added by WorkflowEnhancements1710000000000 are dropped here so no
 * obsolete schema remains. `down()` restores the schema shape (without
 * restoring any per-user verification values, which no longer exist).
 */
export class RemoveAadhaarVerification1793846400000 implements MigrationInterface {
  name = 'RemoveAadhaarVerification1793846400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "organizerVerificationStatus"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "aadhaarMasked"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "verifiedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationStatus"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationStatus" varchar DEFAULT 'unverified'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verifiedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aadhaarMasked" varchar`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizerVerificationStatus" varchar DEFAULT 'unverified'`);
  }
}
