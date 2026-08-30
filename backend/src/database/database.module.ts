import { Module, Global, OnApplicationBootstrap } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'participant',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_by VARCHAR(255) NOT NULL,
    organizers TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    leader_id VARCHAR(255) NOT NULL DEFAULT 'system',
    members TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL DEFAULT 'user', -- 'organizer' | 'user'
    target_id VARCHAR(255),
    reported_by VARCHAR(255) NOT NULL DEFAULT 'system',
    organizers TEXT[] NOT NULL DEFAULT '{}',
    title VARCHAR(500),
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open' | 'under_review' | 'resolved' | 'escalated'
    resolution_notes TEXT,
    resolved_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Revenue: Fee configuration per competition
  -- platform_fee = max(50, 0.07 * prize_pool) (computed in INR)
  CREATE TABLE IF NOT EXISTS competition_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    entry_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    prize_pool NUMERIC(12,2) NOT NULL DEFAULT 0,
    platform_fee NUMERIC(12,2) NOT NULL DEFAULT 50,
    platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 7.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(competition_id)
  );

  -- Revenue: Transactions table for financial tracking
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'platform_fee' | 'entry_fee' | 'prize_payout'
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useValue: pool,
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationBootstrap {
  async onApplicationBootstrap() {
    try {
      await pool.query(schema);
      console.log('✓ PostgreSQL schema initialized (all tables ready)');

      // Migrations for existing DB if columns are missing
      await pool.query(`
        ALTER TABLE disputes ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) NOT NULL DEFAULT 'user';
        ALTER TABLE disputes ADD COLUMN IF NOT EXISTS target_id VARCHAR(255);
        ALTER TABLE disputes ADD COLUMN IF NOT EXISTS title VARCHAR(500);
        ALTER TABLE disputes ALTER COLUMN team_id DROP NOT NULL;
      `).catch(() => {});

      // Seed demo accounts if table is empty
      const { rows } = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(rows[0].count, 10) === 0) {
        await pool.query(`
          INSERT INTO users (email, username, first_name, last_name, role) VALUES
            ('regular@nexus.gg',    'regular@nexus.gg',    'Regular', 'User',  'participant'),
            ('admin@nexus.gg',      'admin@nexus.gg',      'Admin',   'User',  'admin'),
            ('superadmin@nexus.gg', 'superadmin@nexus.gg', 'Super',   'Admin', 'super_admin')
          ON CONFLICT (email) DO NOTHING;
        `);
        console.log('✓ Demo accounts seeded into PostgreSQL');
      }
    } catch (err) {
      console.error('✗ Failed to initialize PostgreSQL schema:', err.message);
      throw err;
    }
  }
}
