import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { ICompetitionFee, ITransaction } from '@/common/interfaces';
import { PG_POOL } from '@/database/database.module';

@Injectable()
export class RevenueRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private mapFeeRow(row: any): ICompetitionFee {
    return {
      id: row.id,
      competitionId: row.competition_id,
      entryFee: parseFloat(row.entry_fee || '0'),
      prizePool: parseFloat(row.prize_pool || '0'),
      platformFee: parseFloat(row.platform_fee || '50'),
      platformFeePct: parseFloat(row.platform_fee_pct || '7.00'),
      currency: row.currency || 'INR',
      feePaid: !!row.fee_paid,
      createdAt: new Date(row.created_at),
    };
  }

  private mapTransactionRow(row: any): ITransaction {
    return {
      id: row.id,
      competitionId: row.competition_id ?? undefined,
      teamId: row.team_id ?? undefined,
      type: row.type,
      amount: parseFloat(row.amount || '0'),
      currency: row.currency || 'INR',
      description: row.description ?? undefined,
      status: row.status || 'completed',
      createdAt: new Date(row.created_at),
    };
  }

  async upsertFee(
    competitionId: string,
    entryFee: number,
    prizePool: number,
    platformFee: number,
    platformFeePct: number = 7.0,
    currency: string = 'INR',
    feePaid: boolean = false,
  ): Promise<ICompetitionFee> {
    const { rows } = await this.pool.query(
      `INSERT INTO competition_fees (competition_id, entry_fee, prize_pool, platform_fee, platform_fee_pct, currency, fee_paid)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (competition_id) DO UPDATE SET
         entry_fee = EXCLUDED.entry_fee,
         prize_pool = EXCLUDED.prize_pool,
         platform_fee = EXCLUDED.platform_fee,
         platform_fee_pct = EXCLUDED.platform_fee_pct,
         currency = EXCLUDED.currency,
         fee_paid = competition_fees.fee_paid OR EXCLUDED.fee_paid
       RETURNING *`,
      [competitionId, entryFee, prizePool, platformFee, platformFeePct, currency, feePaid],
    );
    return this.mapFeeRow(rows[0]);
  }

  async findFeeByCompetitionId(competitionId: string): Promise<ICompetitionFee | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM competition_fees WHERE competition_id = $1',
      [competitionId],
    );
    return rows.length ? this.mapFeeRow(rows[0]) : null;
  }

  async setFeePaid(competitionId: string, paid: boolean): Promise<ICompetitionFee> {
    const { rows } = await this.pool.query(
      `UPDATE competition_fees 
       SET fee_paid = $2 
       WHERE competition_id = $1 
       RETURNING *`,
      [competitionId, paid],
    );
    if (!rows.length) {
      throw new NotFoundException(`Fee config for competition ${competitionId} not found`);
    }
    return this.mapFeeRow(rows[0]);
  }

  async createTransaction(
    competitionId: string | null,
    teamId: string | null,
    type: 'platform_fee' | 'entry_fee' | 'prize_payout',
    amount: number,
    currency: string = 'INR',
    description?: string,
  ): Promise<ITransaction> {
    const { rows } = await this.pool.query(
      `INSERT INTO transactions (competition_id, team_id, type, amount, currency, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')
       RETURNING *`,
      [competitionId, teamId, type, amount, currency, description || null],
    );
    return this.mapTransactionRow(rows[0]);
  }

  async findAllTransactions(competitionId?: string): Promise<ITransaction[]> {
    if (competitionId) {
      const { rows } = await this.pool.query(
        'SELECT * FROM transactions WHERE competition_id = $1 ORDER BY created_at DESC',
        [competitionId],
      );
      return rows.map((r) => this.mapTransactionRow(r));
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM transactions ORDER BY created_at DESC',
    );
    return rows.map((r) => this.mapTransactionRow(r));
  }

  async getRevenueStats(): Promise<any> {
    const [platformFeesRes, entryFeesRes, payoutsRes, totalCompsRes, allFeesRes] = await Promise.all([
      this.pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
         FROM transactions 
         WHERE type = 'platform_fee' AND status = 'completed'`,
      ),
      this.pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
         FROM transactions 
         WHERE type = 'entry_fee' AND status = 'completed'`,
      ),
      this.pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
         FROM transactions 
         WHERE type = 'prize_payout' AND status = 'completed'`,
      ),
      this.pool.query('SELECT COUNT(*) AS count FROM competitions'),
      this.pool.query('SELECT COALESCE(SUM(prize_pool), 0) AS total_prize_pool, COALESCE(SUM(platform_fee), 0) AS total_platform_fee FROM competition_fees'),
    ]);

    const totalPlatformFeeCollected = parseFloat(platformFeesRes.rows[0].total);
    const totalEntryFeeCollected = parseFloat(entryFeesRes.rows[0].total);
    const totalPayouts = parseFloat(payoutsRes.rows[0].total);
    const totalPrizePoolsConfigured = parseFloat(allFeesRes.rows[0].total_prize_pool);
    const netRevenue = totalPlatformFeeCollected;

    return {
      currency: 'INR',
      symbol: '₹',
      formula: 'Platform Fee = max(₹50, 7% of prize pool)',
      totalPlatformFeeCollected,
      totalPrizePoolsConfigured,
      totalEntryFeeCollected,
      totalPayouts,
      netRevenue,
      transactionCounts: {
        platformFees: parseInt(platformFeesRes.rows[0].count, 10),
        entryFees: parseInt(entryFeesRes.rows[0].count, 10),
        prizePayouts: parseInt(payoutsRes.rows[0].count, 10),
        totalCompetitions: parseInt(totalCompsRes.rows[0].count, 10),
      },
    };
  }
}
