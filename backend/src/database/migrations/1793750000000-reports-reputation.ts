import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds organiser reputation, sanctions, prize-pool exceptions and the complete
 * report/dispute management schema. Additive only — no existing table or row
 * is modified beyond the nullable `competitions.prizeExceptionId` column.
 */
export class ReportsReputation1793750000000 implements MigrationInterface {
  name = 'ReportsReputation1793750000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS "platform_settings" (
      "key" varchar(80) PRIMARY KEY,
      "value" text NOT NULL,
      "updatedBy" varchar(100),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `INSERT INTO "platform_settings" ("key", "value") VALUES ('max_prize_pool', '300000') ON CONFLICT ("key") DO NOTHING`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "organiser_reputation" (
      "username" varchar(100) PRIMARY KEY,
      "level" varchar(10) NOT NULL DEFAULT 'blue',
      "qualifyingAbove50k" int NOT NULL DEFAULT 0,
      "qualifyingAbove7k" int NOT NULL DEFAULT 0,
      "qualifyingAbove5k" int NOT NULL DEFAULT 0,
      "orangeRecoveryCount" int NOT NULL DEFAULT 0,
      "paidOnTimeCount" int NOT NULL DEFAULT 0,
      "overduePaymentCount" int NOT NULL DEFAULT 0,
      "mediumViolationCount" int NOT NULL DEFAULT 0,
      "outstandingObligations" float NOT NULL DEFAULT 0,
      "bannedUntil" timestamptz,
      "banCount" int NOT NULL DEFAULT 0,
      "lifetimeBan" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "organiser_reputation_level" CHECK ("level" IN ('blue','green','orange','red'))
    )`);

    await runner.query(`CREATE TABLE IF NOT EXISTS "organiser_reputation_history" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "username" varchar(100) NOT NULL,
      "fromLevel" varchar(10),
      "toLevel" varchar(10) NOT NULL,
      "reason" text NOT NULL,
      "policy" varchar(120),
      "reportId" uuid,
      "reviewer" varchar(100),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "reputation_history_user" ON "organiser_reputation_history" ("username", "createdAt" DESC)`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "organiser_sanctions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "username" varchar(100) NOT NULL,
      "type" varchar(40) NOT NULL,
      "reason" text NOT NULL,
      "reportId" uuid,
      "appliedBy" varchar(100),
      "startsAt" timestamptz NOT NULL DEFAULT now(),
      "endsAt" timestamptz,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "sanctions_user" ON "organiser_sanctions" ("username", "active")`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "prize_pool_exceptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "organiserUsername" varchar(100) NOT NULL,
      "competitionId" uuid,
      "requestedAmount" float NOT NULL,
      "reason" text NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'pending',
      "reviewer" varchar(100),
      "reviewNote" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "prize_exception_status" CHECK ("status" IN ('pending','approved','rejected'))
    )`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "prize_exceptions_organiser" ON "prize_pool_exceptions" ("organiserUsername", "status")`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" uuid NOT NULL,
      "matchId" varchar(100),
      "reporterUsername" varchar(100) NOT NULL,
      "reporterRole" varchar(40) NOT NULL DEFAULT 'participant',
      "reporterTeamId" varchar(100),
      "reportedUsername" varchar(100) NOT NULL,
      "reportedRole" varchar(40) NOT NULL,
      "reportedTeamId" varchar(100),
      "firstLevel" varchar(40) NOT NULL DEFAULT 'organiser',
      "reasonCode" varchar(60) NOT NULL,
      "category" varchar(60) NOT NULL,
      "priority" varchar(10) NOT NULL DEFAULT 'medium',
      "description" text NOT NULL,
      "incidentAt" timestamptz,
      "sourcePage" varchar(200),
      "status" varchar(24) NOT NULL DEFAULT 'new',
      "queue" varchar(16) NOT NULL,
      "assignedTo" varchar(100),
      "finding" varchar(40),
      "action" varchar(40),
      "conclusion" text,
      "discardReason" varchar(60),
      "discardNote" text,
      "resolvedBy" varchar(100),
      "resolvedAt" timestamptz,
      "relatedReportId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "reports_status" CHECK ("status" IN ('new','under_review','awaiting_response','resolved','discarded')),
      CONSTRAINT "reports_queue" CHECK ("queue" IN ('organiser','moderator'))
    )`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "reports_queue_status" ON "reports" ("queue", "status")`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "reports_reporter_competition" ON "reports" ("competitionId", "reporterUsername", "status")`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "reports_reported" ON "reports" ("reportedUsername", "queue")`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "report_evidence" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "reportId" uuid NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
      "url" text NOT NULL,
      "filename" varchar(260),
      "mimetype" varchar(120),
      "sizeBytes" int NOT NULL DEFAULT 0,
      "uploadedBy" varchar(100) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "report_evidence_report" ON "report_evidence" ("reportId")`);

    await runner.query(`CREATE TABLE IF NOT EXISTS "report_discussions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "reportId" uuid NOT NULL UNIQUE REFERENCES "reports"("id") ON DELETE CASCADE,
      "status" varchar(16) NOT NULL DEFAULT 'open',
      "createdBy" varchar(100) NOT NULL,
      "endedBy" varchar(100),
      "endedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "discussion_status" CHECK ("status" IN ('open','ended'))
    )`);

    await runner.query(`CREATE TABLE IF NOT EXISTS "report_discussion_participants" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "discussionId" uuid NOT NULL REFERENCES "report_discussions"("id") ON DELETE CASCADE,
      "username" varchar(100) NOT NULL,
      "role" varchar(40) NOT NULL DEFAULT 'participant',
      "addedBy" varchar(100),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "discussion_participant_unique" UNIQUE ("discussionId", "username")
    )`);

    await runner.query(`CREATE TABLE IF NOT EXISTS "report_discussion_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "discussionId" uuid NOT NULL REFERENCES "report_discussions"("id") ON DELETE CASCADE,
      "authorUsername" varchar(100) NOT NULL,
      "body" text NOT NULL,
      "evidenceUrls" text NOT NULL DEFAULT '',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "discussion_messages_discussion" ON "report_discussion_messages" ("discussionId", "createdAt")`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "report_status_history" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "reportId" uuid NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
      "fromStatus" varchar(24),
      "toStatus" varchar(24) NOT NULL,
      "actor" varchar(100),
      "note" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "report_status_history_report" ON "report_status_history" ("reportId", "createdAt")`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "report_audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "reportId" uuid,
      "action" varchar(80) NOT NULL,
      "actor" varchar(100),
      "details" text,
      "metadata" jsonb NOT NULL DEFAULT '{}',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "report_audit_report" ON "report_audit_logs" ("reportId", "createdAt" DESC)`,
    );

    await runner.query(`CREATE TABLE IF NOT EXISTS "reporting_restrictions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" uuid NOT NULL,
      "username" varchar(100) NOT NULL,
      "discardedCount" int NOT NULL DEFAULT 0,
      "restricted" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "reporting_restriction_unique" UNIQUE ("competitionId", "username")
    )`);

    await runner.query(`ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "prizeExceptionId" uuid`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "competitions" DROP COLUMN IF EXISTS "prizeExceptionId"`);
    for (const table of [
      'reporting_restrictions',
      'report_audit_logs',
      'report_status_history',
      'report_discussion_messages',
      'report_discussion_participants',
      'report_discussions',
      'report_evidence',
      'reports',
      'prize_pool_exceptions',
      'organiser_sanctions',
      'organiser_reputation_history',
      'organiser_reputation',
      'platform_settings',
    ]) {
      await runner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }
}
