import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEXUS ESPORTS — participation revocation, organiser complaints and admin
 * role cleanup.
 *
 * 1. The Dispute Admin, Comp Admin and Revenue Admin roles are retired. Their
 *    responsibilities are carried by the existing Admin role, so those accounts
 *    are mapped to `admin` explicitly (never to Super Admin). Audit rows are
 *    untouched, and an account whose role cannot be read safely falls back to
 *    participant with its privileged access removed.
 * 2. Reports gain the original report / decision context used by a complaint
 *    filed against the reviewing organiser.
 * 3. `competition_removals` is the authoritative participation-revocation
 *    record used by the API guards.
 */
export class ParticipationAndRoleCleanup1793900000000 implements MigrationInterface {
  name = 'ParticipationAndRoleCleanup1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Retire the three sub-admin roles ─────────────────────────────────
    // Explicit mapping: their operational duties belong to `admin`.
    await queryRunner.query(`
      UPDATE "users"
      SET role = 'admin', "adminType" = 'admin'
      WHERE lower(role) IN ('comp_admin', 'dispute_admin', 'revenue_admin')
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "adminType" = 'admin'
      WHERE lower("adminType") IN ('comp_admin', 'dispute_admin', 'revenue_admin')
        AND lower(role) = 'admin'
    `);
    // A privileged marker on an otherwise unknown role is not safe to map, so
    // privileged access is dropped and the account is flagged for review.
    await queryRunner.query(`
      UPDATE "users"
      SET role = 'participant', "adminType" = NULL,
          "revokedReason" = COALESCE("revokedReason", 'Legacy administrative role removed — review by Super Admin')
      WHERE lower("adminType") IN ('comp_admin', 'dispute_admin', 'revenue_admin')
        AND lower(role) NOT IN ('admin', 'super_admin')
    `);

    // ── 2. Complaint context on reports ─────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "originalReportId" varchar`);
    await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "originalDecision" text`);

    // ── 3. Participation revocation ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "competition_removals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "competitionId" varchar NOT NULL,
        "username" varchar NOT NULL,
        "removedBy" varchar,
        "reportId" varchar,
        "reason" text,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_competition_removals_competition_username"
      ON "competition_removals" ("competitionId", "username")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "competition_removals"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "originalDecision"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "originalReportId"`);
    // Role values are intentionally not restored: the retired roles no longer
    // exist in the application, and restoring them would recreate privileged
    // accounts with no dashboard.
  }
}
