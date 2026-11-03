import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the retired simulated identity-verification columns from "users".
 *
 * Only these verification columns are dropped. Credentials, roles, profile
 * fields, bans, warnings and every other account column are left untouched, so
 * existing accounts keep working and no unrelated data is destroyed.
 */
export class RemoveAadhaarVerification1793846400000 implements MigrationInterface {
  name = 'RemoveAadhaarVerification1793846400000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "organizerVerificationStatus"`);
    await runner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "aadhaarMasked"`);
    await runner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "verifiedAt"`);
    await runner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationStatus"`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationStatus" varchar DEFAULT 'unverified'`);
    await runner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verifiedAt" timestamptz`);
    await runner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aadhaarMasked" varchar`);
    await runner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizerVerificationStatus" varchar DEFAULT 'unverified'`);
  }
}
