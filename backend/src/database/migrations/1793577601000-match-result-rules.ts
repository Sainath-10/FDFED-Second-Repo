import { MigrationInterface, QueryRunner } from 'typeorm';

export class MatchResultRules1793577601000 implements MigrationInterface {
  name = 'MatchResultRules1793577601000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "resultRule" varchar NOT NULL DEFAULT 'standard'`);
    await runner.query(`ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "resultDetails" jsonb`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "resultDetails"`);
    await runner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "resultRule"`);
  }
}
