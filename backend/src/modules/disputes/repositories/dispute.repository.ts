import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { IDispute } from '@/common/interfaces';
import { PG_POOL } from '@/database/database.module';

@Injectable()
export class DisputeRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private mapRow(row: any): IDispute {
    return {
      id: row.id,
      competitionId: row.competition_id,
      teamId: row.team_id ?? undefined,
      targetType: (row.target_type as 'organizer' | 'user') || 'user',
      targetId: row.target_id ?? undefined,
      reportedBy: row.reported_by,
      organizers: row.organizers || [],
      title: row.title ?? undefined,
      description: row.description,
      status: row.status as 'open' | 'under_review' | 'resolved' | 'escalated',
      resolutionNotes: row.resolution_notes ?? undefined,
      resolvedBy: row.resolved_by ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }

  async create(
    competitionId: string,
    teamId: string | null,
    targetType: 'organizer' | 'user',
    targetId: string | null,
    title: string | null,
    description: string,
    reportedBy: string = 'system',
    organizers: string[] = ['organizer'],
  ): Promise<IDispute> {
    const { rows } = await this.pool.query(
      `INSERT INTO disputes (competition_id, team_id, target_type, target_id, title, description, reported_by, organizers, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        competitionId,
        teamId || null,
        targetType,
        targetId || null,
        title || (targetType === 'organizer' ? 'Dispute against Tournament Organizer' : 'Dispute against User / Team'),
        description,
        reportedBy,
        organizers,
        targetType === 'organizer' ? 'escalated' : 'open',
      ],
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<IDispute | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM disputes WHERE id = $1',
      [id],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findAll(targetType?: 'organizer' | 'user', status?: string): Promise<IDispute[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (targetType) {
      conditions.push(`target_type = $${idx++}`);
      values.push(targetType);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM disputes ${whereClause} ORDER BY created_at DESC`,
      values,
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByTargetType(targetType: 'organizer' | 'user'): Promise<IDispute[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM disputes WHERE target_type = $1 ORDER BY created_at DESC',
      [targetType],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByCompetition(competitionId: string): Promise<IDispute[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM disputes WHERE competition_id = $1 ORDER BY created_at DESC',
      [competitionId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByTeam(teamId: string): Promise<IDispute[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM disputes WHERE team_id = $1 ORDER BY created_at DESC',
      [teamId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByOrganizer(organizerId: string): Promise<IDispute[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM disputes WHERE $1 = ANY(organizers) ORDER BY created_at DESC',
      [organizerId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByStatus(
    status: 'open' | 'under_review' | 'resolved' | 'escalated',
  ): Promise<IDispute[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM disputes WHERE status = $1 ORDER BY created_at DESC',
      [status],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async update(id: string, updates: Partial<IDispute>): Promise<IDispute> {
    const dispute = await this.findById(id);
    if (!dispute) throw new NotFoundException(`Dispute with ID ${id} not found`);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.resolutionNotes !== undefined) { fields.push(`resolution_notes = $${idx++}`); values.push(updates.resolutionNotes); }
    if (updates.resolvedBy !== undefined) { fields.push(`resolved_by = $${idx++}`); values.push(updates.resolvedBy); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }

    if (!fields.length) return dispute;

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE disputes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return this.mapRow(rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM disputes WHERE id = $1',
      [id],
    );
    return rowCount > 0;
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*) FROM disputes');
    return parseInt(rows[0].count, 10);
  }

  async countByStatus(
    status: 'open' | 'under_review' | 'resolved' | 'escalated',
  ): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*) FROM disputes WHERE status = $1',
      [status],
    );
    return parseInt(rows[0].count, 10);
  }
}
