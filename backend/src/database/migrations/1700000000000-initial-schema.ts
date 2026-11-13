import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema: the core tables every later migration alters.
 *
 * Earlier installs created these tables with `synchronize`, so the first real
 * migration (1710000000000) assumed they already existed and failed on an empty
 * database. This baseline creates them as they were before the later
 * migrations add their columns. Every statement is IF NOT EXISTS, so on a
 * database that already has these tables it does nothing.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar NOT NULL UNIQUE,
      "username" varchar NOT NULL UNIQUE,
      "password_hash" varchar NOT NULL DEFAULT '',
      "role" varchar NOT NULL DEFAULT 'participant',
      "adminType" varchar,
      "revokedReason" text,
      "banned" boolean NOT NULL DEFAULT false,
      "warningCount" integer NOT NULL DEFAULT 0,
      "profilePicUrl" text,
      "bio" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "competitions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar NOT NULL,
      "description" text NOT NULL,
      "startDate" timestamptz NOT NULL,
      "endDate" timestamptz NOT NULL,
      "status" varchar NOT NULL DEFAULT 'active',
      "createdBy" varchar NOT NULL,
      "organizers" text NOT NULL DEFAULT '',
      "game" varchar,
      "type" varchar,
      "location" varchar,
      "prizePool" varchar,
      "prize" double precision,
      "format" varchar,
      "season" varchar,
      "maxTeams" integer NOT NULL DEFAULT 0,
      "maxPlayersPerTeam" integer NOT NULL DEFAULT 0,
      "img" text,
      "badge" varchar,
      "badgeClass" varchar,
      "bannerColor" varchar,
      "approvalStatus" varchar NOT NULL DEFAULT 'approved',
      "approvalUpdatedBy" varchar,
      "approvalUpdatedAt" timestamptz,
      "platformFee" double precision,
      "feeType" varchar,
      "entryFeeAmount" double precision,
      "entryFee" varchar,
      "organizerPaid" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "teams" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar NOT NULL,
      "competitionId" varchar NOT NULL,
      "leaderId" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "statusUpdatedBy" varchar,
      "statusUpdatedAt" timestamptz,
      "warningsCount" integer NOT NULL DEFAULT 0,
      "memberUsernames" text NOT NULL DEFAULT '',
      "createdBy" varchar,
      "leaderUsername" varchar,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "matches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" varchar NOT NULL,
      "team1Id" varchar,
      "team2Id" varchar,
      "team1Name" varchar,
      "team2Name" varchar,
      "winnerId" varchar,
      "winnerName" varchar,
      "score" varchar,
      "status" varchar NOT NULL DEFAULT 'scheduled',
      "scheduledAt" timestamptz,
      "round" varchar,
      "notes" text,
      "createdBy" varchar,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "disputes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" varchar NOT NULL,
      "matchId" varchar,
      "teamId" varchar,
      "reportedBy" varchar NOT NULL,
      "organizers" text NOT NULL DEFAULT '',
      "targetType" varchar NOT NULL,
      "targetUserOrTeam" varchar,
      "reason" text NOT NULL,
      "evidenceUrls" text NOT NULL DEFAULT '',
      "status" varchar NOT NULL DEFAULT 'open_organizer',
      "organizerNotes" text,
      "adminNotes" text,
      "resolvedBy" varchar,
      "banRequested" boolean NOT NULL DEFAULT false,
      "banApplied" boolean NOT NULL DEFAULT false,
      "organizerWarnings" integer NOT NULL DEFAULT 0,
      "teamBanned" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "notifications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "toUsername" varchar NOT NULL,
      "type" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "title" varchar NOT NULL,
      "body" text NOT NULL DEFAULT '',
      "read" boolean NOT NULL DEFAULT false,
      "meta" json,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "team_join_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "teamId" varchar NOT NULL,
      "competitionId" varchar NOT NULL,
      "fromUsername" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "message" text,
      "reviewedBy" varchar,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "team_invites" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "teamId" varchar NOT NULL,
      "competitionId" varchar NOT NULL,
      "toUsername" varchar NOT NULL,
      "fromUsername" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "platform_policies" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "title" varchar NOT NULL,
      "content" text NOT NULL,
      "category" varchar,
      "version" varchar,
      "active" boolean NOT NULL DEFAULT true,
      "createdBy" varchar NOT NULL,
      "compliance" double precision,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "revenue_transactions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" varchar,
      "competitionName" varchar,
      "organizerName" varchar,
      "grossAmount" double precision NOT NULL DEFAULT 0,
      "platformFee" double precision NOT NULL DEFAULT 0,
      "netPayout" double precision NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'CONFIRMED',
      "date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "revenue_configs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "percentage" double precision NOT NULL DEFAULT 7,
      "minCost" double precision NOT NULL DEFAULT 50,
      "updatedBy" varchar,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "admin_activity_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "adminUsername" varchar NOT NULL DEFAULT 'admin@nexus.gg',
      "actionType" varchar NOT NULL,
      "details" text NOT NULL,
      "metadata" json,
      "timestamp" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(): Promise<void> {
    throw new Error('The baseline schema cannot be rolled back without losing every table.');
  }
}
