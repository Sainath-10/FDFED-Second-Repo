import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Co-organizers must accept before they gain any power over a competition.
 * Invited usernames wait in "pendingOrganizers" until they accept or decline.
 */
export class CoOrganizerInvitations1794000000000 implements MigrationInterface {
  name = 'CoOrganizerInvitations1794000000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "pendingOrganizers" text NOT NULL DEFAULT ''`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "pendingOrganizers"`);
  }
}
