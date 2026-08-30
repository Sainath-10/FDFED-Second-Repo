import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { ICompetition } from '@/common/interfaces';
import { PG_POOL } from '@/database/database.module';

@Injectable()
export class CompetitionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private mapRow(row: any): ICompetition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      status: row.status as 'draft' | 'active' | 'completed',
      createdBy: row.created_by,
      organizers: row.organizers || [],
      createdAt: new Date(row.created_at),
    };
  }

  async create(
    name: string,
    description: string,
    startDate: Date,
    endDate: Date,
    createdBy: string = 'system',
    coOrganizers: string[] = [],
  ): Promise<ICompetition> {
    const organizersSet = Array.from(new Set([createdBy, ...coOrganizers]));

    const { rows } = await this.pool.query(
      `INSERT INTO competitions (name, description, start_date, end_date, status, created_by, organizers)
       VALUES ($1, $2, $3, $4, 'active', $5, $6)
       RETURNING *`,
      [name, description, startDate, endDate, createdBy, organizersSet],
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<ICompetition | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM competitions WHERE id = $1',
      [id],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findAll(): Promise<ICompetition[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM competitions ORDER BY created_at DESC',
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByCreator(userId: string): Promise<ICompetition[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM competitions
       WHERE created_by = $1 OR $1 = ANY(organizers)
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByOrganizer(userId: string): Promise<ICompetition[]> {
    return this.findByCreator(userId);
  }

  async addCoOrganizer(id: string, organizerId: string): Promise<ICompetition> {
    const { rows } = await this.pool.query(
      `UPDATE competitions
       SET organizers = array_append(organizers, $2)
       WHERE id = $1 AND NOT ($2 = ANY(organizers))
       RETURNING *`,
      [id, organizerId],
    );
    if (!rows.length) {
      // Either already exists or not found — fetch current
      const current = await this.findById(id);
      if (!current) throw new NotFoundException(`Competition ${id} not found`);
      return current;
    }
    return this.mapRow(rows[0]);
  }

  async removeCoOrganizer(id: string, organizerId: string): Promise<ICompetition> {
    const comp = await this.findById(id);
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);
    // Do not remove the primary creator
    if (comp.createdBy === organizerId) return comp;

    const { rows } = await this.pool.query(
      `UPDATE competitions
       SET organizers = array_remove(organizers, $2)
       WHERE id = $1
       RETURNING *`,
      [id, organizerId],
    );
    return this.mapRow(rows[0]);
  }

  async update(id: string, updates: Partial<ICompetition>): Promise<ICompetition> {
    const comp = await this.findById(id);
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.endDate !== undefined) { fields.push(`end_date = $${idx++}`); values.push(updates.endDate); }

    if (!fields.length) return comp;

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE competitions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return this.mapRow(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM competitions WHERE id = $1', [id]);
  }

  async findByStatus(status: 'draft' | 'active' | 'completed'): Promise<ICompetition[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM competitions WHERE status = $1 ORDER BY created_at DESC',
      [status],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*) FROM competitions');
    return parseInt(rows[0].count, 10);
  }
}
