import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEXUS ESPORTS — competition date-edit limits.
 *
 * Counts how often an organiser changed the schedule: at most 2 saves before
 * play starts, and at most 2 end-date changes after it starts. Existing
 * competitions start at 0. Safe to run on any teammate's database (IF NOT EXISTS).
 */
export class CompetitionDateEditLimits1794500000000 implements MigrationInterface {
  name = 'CompetitionDateEditLimits1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "dateEditCount" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "endDateEditCount" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "endDateEditCount"`);
    await queryRunner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "dateEditCount"`);
  }
}
