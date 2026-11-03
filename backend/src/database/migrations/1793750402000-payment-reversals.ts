import { MigrationInterface, QueryRunner } from 'typeorm';

/** Allows finance fraud reversals: CLAWBACK ledger entries and the REVERSED status. */
export class PaymentReversals1793750402000 implements MigrationInterface {
  name = 'PaymentReversals1793750402000';
  async up(r: QueryRunner): Promise<void> {
    // The previous checks were unnamed; find them by definition so this also works on synchronized dev schemas.
    await r.query(`DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND contype='c'
        AND (pg_get_constraintdef(oid) LIKE '%PLATFORM_FEE%' OR pg_get_constraintdef(oid) LIKE '%ESCROWED%') LOOP
        EXECUTE format('ALTER TABLE payment_transactions DROP CONSTRAINT %I', c.conname);
      END LOOP; END $$`);
    await r.query(`ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_type_allowed CHECK (type IN ('PLATFORM_FEE','PRIZE_POOL','REGISTRATION','REFUND','PAYOUT','REG_FEE_RELEASED','PRIZE_RETURN','CLAWBACK')),
      ADD CONSTRAINT payment_transactions_status_allowed CHECK (status IN ('PENDING','CONFIRMED','FAILED','ESCROWED','REFUNDED','RELEASED','REVERSED'))`);
  }
  async down(): Promise<void> { throw new Error('Payment ledger migrations require an explicit data-preserving rollback.'); }
}
