import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Databases created while AuditLogEntity mapped `entityType` to "entity_type"
 * still have that column name, so every audit read (staff Activity page) and
 * write failed. Renames it to the "entityType" the entity now expects.
 */
export class AuditLogEntityType1794200000000 implements MigrationInterface {
  name = 'AuditLogEntityType1794200000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entityType') THEN
          ALTER TABLE "audit_logs" RENAME COLUMN "entity_type" TO "entityType";
        END IF;
      END $$;
    `);
  }

  async down(): Promise<void> {
    // Forward-only fix: restoring the stale name would break the entity again.
  }
}
