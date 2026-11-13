import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Case-discussion attachments were a TypeORM simple-array (comma-joined text).
 * Evidence is a data URL ("data:image/jpeg;base64,…"), so reading it back split
 * each image into two broken pieces. Attachments now live in a jsonb "evidence"
 * column with their file details; existing rows are rebuilt by re-joining each
 * "data:…" prefix with the base64 payload that follows it.
 */
export class DiscussionMessageEvidence1794200001000 implements MigrationInterface {
  name = 'DiscussionMessageEvidence1794200001000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE "report_discussion_messages" ADD COLUMN IF NOT EXISTS "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );

    const hasLegacy = await runner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'report_discussion_messages' AND column_name = 'evidenceUrls'`,
    );
    if (!hasLegacy.length) return;

    const rows: { id: string; evidenceUrls: string }[] = await runner.query(
      `SELECT "id", "evidenceUrls" FROM "report_discussion_messages" WHERE "evidenceUrls" <> '' AND "evidence" = '[]'::jsonb`,
    );
    for (const row of rows) {
      const parts = String(row.evidenceUrls).split(',');
      const urls: string[] = [];
      for (let i = 0; i < parts.length; i += 1) {
        if (/^data:[^,]*;base64$/i.test(parts[i]) && i + 1 < parts.length) {
          urls.push(`${parts[i]},${parts[i + 1]}`);
          i += 1;
        } else if (parts[i]) {
          urls.push(parts[i]);
        }
      }
      const evidence = urls.map((url, index) => {
        const data = url.startsWith('data:');
        return {
          url,
          filename: `evidence-${index + 1}`,
          mimetype: data ? url.slice(5, url.indexOf(';')) : 'application/octet-stream',
          size: data ? Math.round((url.length - url.indexOf(',') - 1) * 0.75) : 0,
        };
      });
      await runner.query(`UPDATE "report_discussion_messages" SET "evidence" = $1::jsonb WHERE "id" = $2`, [
        JSON.stringify(evidence),
        row.id,
      ]);
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "report_discussion_messages" DROP COLUMN IF EXISTS "evidence"`);
  }
}
