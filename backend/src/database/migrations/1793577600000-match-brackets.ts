import { MigrationInterface, QueryRunner } from 'typeorm';

export class MatchBrackets1793577600000 implements MigrationInterface {
  name = 'MatchBrackets1793577600000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "bracket" jsonb');
    await queryRunner.query('ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "durationMinutes" integer NOT NULL DEFAULT 60');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "matches" DROP COLUMN IF EXISTS "bracket"');
    await queryRunner.query('ALTER TABLE "matches" DROP COLUMN IF EXISTS "durationMinutes"');
  }
}
