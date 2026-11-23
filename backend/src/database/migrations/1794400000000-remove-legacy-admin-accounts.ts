import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEXUS ESPORTS — remove the retired administrator accounts.
 *
 * The generic Admin role (which replaced the Dispute, Competition and Revenue
 * Admin roles) is removed from the platform. Every account still holding one
 * of those roles is deleted, so it can never sign in again.
 *
 * History stays intact: audit logs, reports, decisions and notifications keep
 * the usernames they recorded (no table has a foreign key to users). One audit
 * entry lists exactly which accounts were removed.
 *
 * Finance Moderator, Community Moderator and Super Admin accounts are never
 * touched.
 *
 * Runs automatically on every teammate's database at backend startup. It is
 * written to work on databases created by older versions of the app: it never
 * relies on column defaults, and if the audit table has an older shape the
 * accounts are still removed (only the summary entry is skipped).
 */
const RETIRED = `('admin', 'comp_admin', 'competition_admin', 'dispute_admin', 'revenue_admin')`;
const MATCH = `lower(coalesce(role::text, '')) IN ${RETIRED} OR lower(coalesce("adminType"::text, '')) IN ${RETIRED}`;
const KEPT = `lower(coalesce(role::text, '')) NOT IN ('super_admin', 'finance_moderator', 'community_moderator')`;
const AUDIT_COLUMNS = ['id', 'actionType', 'actor', 'entityType', 'entityId', 'details', 'metadata', 'createdAt'];

export class RemoveLegacyAdminAccounts1794400000000 implements MigrationInterface {
  name = 'RemoveLegacyAdminAccounts1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) return;
    const hasAdminType = await queryRunner.hasColumn('users', 'adminType');
    const match = hasAdminType ? MATCH : `lower(coalesce(role::text, '')) IN ${RETIRED}`;

    const rows: Array<{ username: string; email: string; role: string }> = await queryRunner.query(
      `SELECT username, email, role::text AS role FROM "users" WHERE (${match}) AND ${KEPT}`,
    );
    if (!rows.length) return;

    if (await this.auditTableReady(queryRunner)) {
      await queryRunner.query(
        `INSERT INTO "audit_logs" ("id", "actionType", "actor", "entityType", "entityId", "details", "metadata", "createdAt")
         VALUES ($1, 'LEGACY_ADMIN_ACCOUNTS_REMOVED', 'system', 'user', NULL, $2, $3::jsonb, now())`,
        [
          randomUUID(),
          `Removed ${rows.length} retired administrator account(s): ${rows.map((r) => `@${r.username}`).join(', ')}.`,
          JSON.stringify({ accounts: rows.map((r) => ({ username: r.username, email: r.email, role: r.role })) }),
        ],
      );
    }
    await queryRunner.query(`DELETE FROM "users" WHERE (${match}) AND ${KEPT}`);
  }

  public async down(): Promise<void> {
    // Deleted accounts cannot be restored; the audit entry lists who they were.
  }

  private async auditTableReady(queryRunner: QueryRunner): Promise<boolean> {
    if (!(await queryRunner.hasTable('audit_logs'))) return false;
    for (const column of AUDIT_COLUMNS) {
      if (!(await queryRunner.hasColumn('audit_logs', column))) return false;
    }
    return true;
  }
}
