import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two separate appeal workflows on reports (organiser appeal and player appeal),
 * each with a required reason and a recorded moderator decision, plus the
 * removal snapshot a reverted player removal needs to restore the roster.
 */
export class AppealWorkflows1794300000000 implements MigrationInterface {
  name = 'AppealWorkflows1794300000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "appealType" varchar NULL`);
    await runner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "appealReason" text NULL`);
    await runner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "appealOutcome" varchar NULL`);
    await runner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "appealDecisionReason" text NULL`);
    await runner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "appealDecidedBy" varchar NULL`);
    await runner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "appealDecidedAt" timestamptz NULL`);
    // Appeals filed before this change were all organiser appeals (the only kind that existed).
    await runner.query(`UPDATE "reports" SET "appealType" = 'organiser' WHERE "appealType" IS NULL AND "appealStatus" IS NOT NULL AND "queue" = 'moderator'`);
    await runner.query(`ALTER TABLE "competition_removals" ADD COLUMN IF NOT EXISTS "restoreSnapshot" jsonb NULL`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "competition_removals" DROP COLUMN IF EXISTS "restoreSnapshot"`);
    for (const column of ['appealDecidedAt', 'appealDecidedBy', 'appealDecisionReason', 'appealOutcome', 'appealReason', 'appealType']) {
      await runner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "${column}"`);
    }
  }
}
