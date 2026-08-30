import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/database/database.module';

/**
 * B2B Partner Service — reads aggregated data for external partners.
 * Only exposes read-only, safe data (no sensitive user info).
 */
@Injectable()
export class PartnerService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getActiveCompetitions(): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, start_date, end_date, status, organizers, created_at
       FROM competitions
       WHERE status = 'active'
       ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      organizerCount: (r.organizers || []).length,
      createdAt: r.created_at,
    }));
  }

  async getCompetitionById(id: string): Promise<any | null> {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.name, c.description, c.start_date, c.end_date, c.status,
              c.organizers, c.created_at,
              COUNT(DISTINCT t.id) AS team_count,
              COUNT(DISTINCT d.id) AS dispute_count
       FROM competitions c
       LEFT JOIN teams t ON t.competition_id = c.id
       LEFT JOIN disputes d ON d.competition_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      organizerCount: (r.organizers || []).length,
      teamCount: parseInt(r.team_count, 10),
      disputeCount: parseInt(r.dispute_count, 10),
      createdAt: r.created_at,
    };
  }

  async getPlatformStats(): Promise<any> {
    const [compResult, teamResult, disputeResult, userResult] = await Promise.all([
      this.pool.query('SELECT COUNT(*) FROM competitions'),
      this.pool.query('SELECT COUNT(*) FROM teams'),
      this.pool.query('SELECT COUNT(*) FROM disputes'),
      this.pool.query('SELECT COUNT(*) FROM users'),
    ]);

    const [openDisputes, resolvedDisputes] = await Promise.all([
      this.pool.query(`SELECT COUNT(*) FROM disputes WHERE status = 'open'`),
      this.pool.query(`SELECT COUNT(*) FROM disputes WHERE status = 'resolved'`),
    ]);

    return {
      platform: 'FDFED Competition Management System',
      generatedAt: new Date().toISOString(),
      stats: {
        totalCompetitions: parseInt(compResult.rows[0].count, 10),
        totalTeams: parseInt(teamResult.rows[0].count, 10),
        totalDisputes: parseInt(disputeResult.rows[0].count, 10),
        totalUsers: parseInt(userResult.rows[0].count, 10),
        openDisputes: parseInt(openDisputes.rows[0].count, 10),
        resolvedDisputes: parseInt(resolvedDisputes.rows[0].count, 10),
      },
    };
  }
}
