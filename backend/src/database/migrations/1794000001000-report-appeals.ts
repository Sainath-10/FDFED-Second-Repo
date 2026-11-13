import { MigrationInterface, QueryRunner } from 'typeorm';

/** One appeal per organiser decision, uplift (reversal) tracking and a versioned decision history. */
export class ReportAppeals1794000001000 implements MigrationInterface {
  name = 'ReportAppeals1794000001000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "reports"
      ADD COLUMN IF NOT EXISTS "appealStatus" varchar,
      ADD COLUMN IF NOT EXISTS "appealCount" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "appealedAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "appealDiscussionId" varchar,
      ADD COLUMN IF NOT EXISTS "uplifted" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "upliftReason" text,
      ADD COLUMN IF NOT EXISTS "upliftedBy" varchar,
      ADD COLUMN IF NOT EXISTS "upliftedAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "competitionDisposition" varchar,
      ADD COLUMN IF NOT EXISTS "decisionHistory" jsonb NOT NULL DEFAULT '[]'`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "reports"
      DROP COLUMN IF EXISTS "appealStatus", DROP COLUMN IF EXISTS "appealCount", DROP COLUMN IF EXISTS "appealedAt",
      DROP COLUMN IF EXISTS "appealDiscussionId", DROP COLUMN IF EXISTS "uplifted", DROP COLUMN IF EXISTS "upliftReason",
      DROP COLUMN IF EXISTS "upliftedBy", DROP COLUMN IF EXISTS "upliftedAt", DROP COLUMN IF EXISTS "competitionDisposition",
      DROP COLUMN IF EXISTS "decisionHistory"`);
  }
}
