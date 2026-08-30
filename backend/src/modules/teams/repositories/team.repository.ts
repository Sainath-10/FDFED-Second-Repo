import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { ITeam } from '@/common/interfaces';
import { PG_POOL } from '@/database/database.module';

@Injectable()
export class TeamRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private mapRow(row: any): ITeam {
    return {
      id: row.id,
      name: row.name,
      competitionId: row.competition_id,
      leaderId: row.leader_id,
      members: row.members || [],
      createdAt: new Date(row.created_at),
    };
  }

  async create(
    name: string,
    competitionId: string,
    members: string[] = [],
  ): Promise<ITeam> {
    const allMembers = Array.from(new Set(['system', ...members]));

    const { rows } = await this.pool.query(
      `INSERT INTO teams (name, competition_id, leader_id, members)
       VALUES ($1, $2, 'system', $3)
       RETURNING *`,
      [name, competitionId, allMembers],
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<ITeam | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM teams WHERE id = $1',
      [id],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findAll(): Promise<ITeam[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM teams ORDER BY created_at DESC',
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByCompetition(competitionId: string): Promise<ITeam[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM teams WHERE competition_id = $1 ORDER BY created_at ASC',
      [competitionId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByLeader(leaderId: string): Promise<ITeam[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM teams WHERE leader_id = $1 ORDER BY created_at DESC',
      [leaderId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async update(id: string, updates: Partial<ITeam>): Promise<ITeam> {
    const team = await this.findById(id);
    if (!team) throw new NotFoundException(`Team with ID ${id} not found`);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.members !== undefined) { fields.push(`members = $${idx++}`); values.push(updates.members); }
    if (updates.leaderId !== undefined) { fields.push(`leader_id = $${idx++}`); values.push(updates.leaderId); }

    if (!fields.length) return team;

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE teams SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return this.mapRow(rows[0]);
  }

  async addMember(teamId: string, memberId: string): Promise<ITeam> {
    const team = await this.findById(teamId);
    if (!team) throw new NotFoundException(`Team with ID ${teamId} not found`);
    if (team.members.includes(memberId)) throw new BadRequestException('Member already in team');

    const { rows } = await this.pool.query(
      `UPDATE teams SET members = array_append(members, $2) WHERE id = $1 RETURNING *`,
      [teamId, memberId],
    );
    return this.mapRow(rows[0]);
  }

  async removeMember(teamId: string, memberId: string): Promise<ITeam> {
    const team = await this.findById(teamId);
    if (!team) throw new NotFoundException(`Team with ID ${teamId} not found`);
    if (team.leaderId === memberId) throw new BadRequestException('Cannot remove team leader');

    const { rows } = await this.pool.query(
      `UPDATE teams SET members = array_remove(members, $2) WHERE id = $1 RETURNING *`,
      [teamId, memberId],
    );
    return this.mapRow(rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM teams WHERE id = $1', [id]);
    return rowCount > 0;
  }
}
