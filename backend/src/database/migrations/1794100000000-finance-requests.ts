import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Finance review requests stored on the competition:
 *  - "largePrizeRequest": prize pools above ₹10,00,000 wait for a finance
 *    moderator's approval (with the organiser's contact details) before publishing.
 *  - "earlyEndRequest": ending a started competition before every fixture is
 *    played needs a reason and a finance moderator's approval.
 * The platform prize-pool ceiling is raised from the old ₹3,00,000 default.
 */
export class FinanceRequests1794100000000 implements MigrationInterface {
  name = 'FinanceRequests1794100000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "largePrizeRequest" jsonb NULL`);
    await runner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "earlyEndRequest" jsonb NULL`);
    await runner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
          UPDATE "platform_settings" SET "value" = '10000000' WHERE "key" = 'max_prize_pool' AND "value" = '300000';
        END IF;
      END $$;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "earlyEndRequest"`);
    await runner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "largePrizeRequest"`);
  }
}
