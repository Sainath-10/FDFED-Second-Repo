import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEXUS ESPORTS — workflow schema changes (§1.5, §12.3, §14).
 *
 * Mirrors backend/migrations/0001_nexus_workflow_enhancements.sql, but as a
 * TypeORM migration so the application can apply it without relying on
 * `synchronize`. Every statement is idempotent, so re-running is safe.
 */
export class WorkflowEnhancements1710000000000 implements MigrationInterface {
  name = 'WorkflowEnhancements1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users — persisted (simulated) verification status
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationStatus" varchar DEFAULT 'unverified'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verifiedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aadhaarMasked" varchar`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizerVerificationStatus" varchar DEFAULT 'unverified'`);
    await queryRunner.query(`COMMENT ON COLUMN "users"."verificationStatus" IS 'SIMULATED workflow flag (mock Aadhaar flow) — NOT UIDAI/KYC identity proof.'`);

    // competitions — visibility, join code, registration window
    await queryRunner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "visibility" varchar DEFAULT 'public'`);
    await queryRunner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "joinCode" varchar`);
    await queryRunner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "registrationOpenAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "registrationCloseAt" timestamptz`);

    // refund_requests — traceable, idempotent via refundKey
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refund_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "refundKey" varchar NOT NULL UNIQUE,
        "competitionId" varchar NOT NULL,
        "competitionName" varchar,
        "teamId" varchar,
        "teamName" varchar,
        "username" varchar NOT NULL,
        "amount" double precision,
        "reason" text NOT NULL,
        "status" varchar DEFAULT 'pending',
        "statusNote" text,
        "resolvedBy" varchar,
        "requestedBy" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // audit_logs — workflow audit trail (never stores Aadhaar/OTP)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actionType" varchar NOT NULL,
        "actor" varchar,
        "entityType" varchar,
        "entityId" varchar,
        "details" text,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_audit_logs_action" ON "audit_logs" ("actionType")`);

    // disputes — prize_not_received and other workflow categories
    await queryRunner.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "category" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "category"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refund_requests"`);
    await queryRunner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "registrationCloseAt"`);
    await queryRunner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "registrationOpenAt"`);
    await queryRunner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "joinCode"`);
    await queryRunner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "visibility"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "organizerVerificationStatus"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "aadhaarMasked"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "verifiedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationStatus"`);
  }
}
