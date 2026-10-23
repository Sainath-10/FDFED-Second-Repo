-- NEXUS ESPORTS — schema changes for the competition / team / verification /
-- tournament workflow enhancements.
--
-- Development uses TypeORM `synchronize: true` (app.module.ts). Production must
-- run migrations; this file captures exactly the columns/tables that
-- synchronize created from the entities in src/entities. Run with:
--   psql "$DATABASE_URL" -f backend/migrations/0001_nexus_workflow_enhancements.sql
--
-- Idempotent (IF NOT EXISTS / IF NOT EXISTS-style guards) so re-runs are safe.

-- ─── users: verification status (§12.3) ───────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationStatus" varchar DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "verifiedAt" timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "aadhaarMasked" varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "organizerVerificationStatus" varchar DEFAULT 'unverified';
COMMENT ON COLUMN users."verificationStatus" IS
  'SIMULATED workflow flag (mock Aadhaar flow) — NOT UIDAI/KYC identity proof.';

-- ─── competitions: visibility / registration window (§2.4, §3.4) ──────────────
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS visibility varchar DEFAULT 'public';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS "joinCode" varchar;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS "registrationOpenAt" timestamptz;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS "registrationCloseAt" timestamptz;

-- ─── refund_requests (§4.2 — traceable, idempotent via refund_key) ────────────
CREATE TABLE IF NOT EXISTS refund_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "refundKey"      varchar NOT NULL UNIQUE,
  "competitionId"  varchar NOT NULL,
  "competitionName" varchar,
  "teamId"         varchar,
  "teamName"       varchar,
  username         varchar NOT NULL,
  amount           double precision,
  reason           text NOT NULL,
  status           varchar DEFAULT 'pending', -- pending|completed|failed|cancelled
  "statusNote"     text,
  "resolvedBy"     varchar,
  "requestedBy"    varchar,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

-- ─── audit_logs (§14 — workflow audit trail; never stores Aadhaar/OTP) ────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actionType" varchar NOT NULL,
  actor        varchar,
  "entityType" varchar,
  "entityId"   varchar,
  details      text,
  metadata     jsonb DEFAULT '{}'::jsonb,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs ("actionType");

-- ─── disputes: category (§13.3 — e.g. prize_not_received) ─────────────────────
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS category varchar;
