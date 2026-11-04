import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentFoundation1793750400000 implements MigrationInterface {
  name = 'PaymentFoundation1793750400000';
  async up(runner: QueryRunner): Promise<void> {
    // Existing competitions need reconciliation; do not invent historical payments.
    await runner.query(`ALTER TABLE competitions ADD COLUMN "paymentStatus" varchar NOT NULL DEFAULT 'LEGACY'`);
    await runner.query(`ALTER TABLE competitions ALTER COLUMN "paymentStatus" SET DEFAULT 'AWAITING_PLATFORM_FEE'`);
    await runner.query(`ALTER TABLE competitions ADD COLUMN "platformFeeTransactionId" uuid`);
    await runner.query(`CREATE TABLE payment_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "competitionId" uuid NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
      "userUsername" varchar NOT NULL,
      type varchar NOT NULL CHECK (type = 'PLATFORM_FEE'),
      direction varchar NOT NULL DEFAULT 'IN' CHECK (direction = 'IN'),
      "amountMinor" integer NOT NULL CHECK ("amountMinor" > 0),
      currency varchar NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
      status varchar NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
      "gatewayOrderId" varchar UNIQUE,
      "gatewayRefId" varchar UNIQUE,
      "paidAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("competitionId", type)
    )`);
    await runner.query(`ALTER TABLE competitions ADD CONSTRAINT competition_platform_transaction_fk FOREIGN KEY ("platformFeeTransactionId") REFERENCES payment_transactions(id)`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE competitions DROP CONSTRAINT competition_platform_transaction_fk`);
    await runner.query(`DROP TABLE payment_transactions`);
    await runner.query(`ALTER TABLE competitions DROP COLUMN "platformFeeTransactionId", DROP COLUMN "paymentStatus"`);
  }
}
