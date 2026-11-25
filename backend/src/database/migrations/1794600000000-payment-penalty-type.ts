import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allows the PENALTY ledger entry used when a competition is ended early (by
 * a finance-approved early-end request or a Community Moderator's "End
 * competition & refund players"). Without it the database rejected the whole
 * termination, so no player was refunded.
 *
 * The type check is found by definition (it was unnamed on some older
 * databases), so this works on every teammate's schema.
 */
export class PaymentPenaltyType1794600000000 implements MigrationInterface {
  name = 'PaymentPenaltyType1794600000000';

  async up(r: QueryRunner): Promise<void> {
    await r.query(`DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND contype='c'
        AND pg_get_constraintdef(oid) LIKE '%PLATFORM_FEE%' LOOP
        EXECUTE format('ALTER TABLE payment_transactions DROP CONSTRAINT %I', c.conname);
      END LOOP; END $$`);
    await r.query(`ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_type_allowed CHECK (type IN ('PLATFORM_FEE','PRIZE_POOL','REGISTRATION','REFUND','PAYOUT','REG_FEE_RELEASED','PRIZE_RETURN','CLAWBACK','PENALTY'))`);
  }

  async down(): Promise<void> { throw new Error('Payment ledger migrations require an explicit data-preserving rollback.'); }
}
