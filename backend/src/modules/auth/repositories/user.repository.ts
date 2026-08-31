import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { IUser, UserRole } from '@/common/interfaces';
import { PG_POOL } from '@/database/database.module';

@Injectable()
export class UserRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private mapRow(row: any): IUser {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      createdAt: new Date(row.created_at),
    };
  }

  async create(
    email: string,
    username: string,
    firstName: string,
    lastName: string,
    role: UserRole = UserRole.PARTICIPANT,
  ): Promise<IUser> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, username, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [email, username, firstName, lastName, role],
    );
    return this.mapRow(rows[0]);
  }

  async createWithPassword(
    email: string,
    username: string,
    firstName: string,
    lastName: string,
    role: UserRole = UserRole.PARTICIPANT,
    passwordHash: string,
  ): Promise<IUser> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [email, username, passwordHash, firstName, lastName, role],
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<IUser | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<IUser | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<IUser | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
      [emailOrUsername],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /**
   * Returns the raw DB row including password_hash for authentication purposes.
   * Use this ONLY in AuthService for password verification.
   */
  async findRawByEmailOrUsername(emailOrUsername: string): Promise<any | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
      [emailOrUsername],
    );
    return rows.length ? rows[0] : null;
  }

  async findAll(): Promise<IUser[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM users ORDER BY created_at ASC',
    );
    return rows.map((r) => this.mapRow(r));
  }

  async updateRole(id: string, role: UserRole): Promise<IUser> {
    const { rows } = await this.pool.query(
      `UPDATE users 
       SET role = $2 
       WHERE id = $1 
       RETURNING *`,
      [id, role],
    );
    if (!rows.length) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.mapRow(rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM users WHERE id = $1',
      [id],
    );
    return rowCount > 0;
  }

  async emailExists(email: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
    );
    return rows.length > 0;
  }

  async usernameExists(username: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)',
      [username],
    );
    return rows.length > 0;
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*) FROM users');
    return parseInt(rows[0].count, 10);
  }
}
