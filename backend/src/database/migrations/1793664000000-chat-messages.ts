import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatMessages1793664000000 implements MigrationInterface {
  name = 'ChatMessages1793664000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS "chat_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" uuid NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
      "teamId" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
      "channel" varchar(16) NOT NULL CHECK ("channel" IN ('announcements', 'general', 'team')),
      "authorUsername" varchar(100) NOT NULL,
      "body" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chat_scope" CHECK (("channel" = 'team' AND "teamId" IS NOT NULL) OR ("channel" <> 'team' AND "teamId" IS NULL))
    )`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "chat_competition_recent" ON "chat_messages" ("competitionId", "channel", "createdAt" DESC)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "chat_team_recent" ON "chat_messages" ("teamId", "createdAt" DESC)`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS "chat_messages"`);
  }
}
