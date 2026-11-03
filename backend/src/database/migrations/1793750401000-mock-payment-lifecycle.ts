import { MigrationInterface, QueryRunner } from 'typeorm';
export class MockPaymentLifecycle1793750401000 implements MigrationInterface {
  name = 'MockPaymentLifecycle1793750401000';
  async up(r: QueryRunner): Promise<void> {
    // Discover generated constraint names so this also works with synchronized dev schemas.
    await r.query(`DO $$ DECLARE c record; BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND contype IN ('c','u') LOOP IF c.conname NOT IN (SELECT conname FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND pg_get_constraintdef(oid) LIKE '%gateway%') THEN EXECUTE format('ALTER TABLE payment_transactions DROP CONSTRAINT %I', c.conname); END IF; END LOOP; END $$`);
    await r.query(`ALTER TABLE payment_transactions ADD COLUMN "subjectKey" varchar NOT NULL DEFAULT '', ADD COLUMN "teamId" varchar`);
    await r.query(`ALTER TABLE payment_transactions ADD UNIQUE ("competitionId",type,"subjectKey"), ADD CHECK ("amountMinor">=0), ADD CHECK (currency='INR'), ADD CHECK (direction IN ('IN','OUT')), ADD CHECK (type IN ('PLATFORM_FEE','PRIZE_POOL','REGISTRATION','REFUND','PAYOUT','REG_FEE_RELEASED','PRIZE_RETURN')), ADD CHECK (status IN ('PENDING','CONFIRMED','FAILED','ESCROWED','REFUNDED','RELEASED'))`);
    await r.query(`ALTER TABLE competitions ADD COLUMN "prizePoolPaid" boolean NOT NULL DEFAULT false, ADD COLUMN "prizePoolPaidAt" timestamptz, ADD COLUMN "prizeDistributionMinor" jsonb NOT NULL DEFAULT '[]', ADD COLUMN "financeHold" boolean NOT NULL DEFAULT false, ADD COLUMN "abandonedReason" text, ADD COLUMN "endedAt" timestamptz`);
    await r.query(`ALTER TABLE users ADD COLUMN "organizerTrustScore" integer NOT NULL DEFAULT 100, ADD COLUMN "competitionAlerts" boolean NOT NULL DEFAULT false`);
    await r.query(`CREATE TABLE escrow_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "competitionId" uuid UNIQUE NOT NULL REFERENCES competitions(id), "prizeMinor" integer NOT NULL DEFAULT 0, "registrationsMinor" integer NOT NULL DEFAULT 0, "payoutsMinor" integer NOT NULL DEFAULT 0, "refundsMinor" integer NOT NULL DEFAULT 0, "balanceMinor" integer NOT NULL DEFAULT 0 CHECK ("balanceMinor">=0), status varchar NOT NULL DEFAULT 'OPEN', "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await r.query(`CREATE TABLE payment_mail (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "eventKey" varchar UNIQUE NOT NULL, "competitionId" uuid NOT NULL REFERENCES competitions(id), username varchar NOT NULL, template varchar NOT NULL, subject varchar NOT NULL, body text NOT NULL, status varchar NOT NULL DEFAULT 'MOCK_DELIVERED', "createdAt" timestamptz NOT NULL DEFAULT now())`);
  }
  async down(): Promise<void> { throw new Error('Payment ledger migrations require an explicit data-preserving rollback.'); }
}
