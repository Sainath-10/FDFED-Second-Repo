import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../../entities/user.entity';
import { UserRole } from '../../../common/interfaces';

export type UserWithPasswordHash = UserEntity & { passwordHash: string };

export interface RawUserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: UserRole;
  banned: boolean;
  warningCount: number;
  profilePicUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(
    email: string,
    username: string,
    passwordHash: string,
    role: UserRole = UserRole.PARTICIPANT,
    adminType: string | null = null,
  ): Promise<UserEntity> {
    const user = this.repo.create({
      email,
      username,
      passwordHash,
      role,
      adminType: adminType || (role === UserRole.SUPER_ADMIN ? 'super_admin' : null),
      banned: false,
      warningCount: 0,
    });
    return this.repo.save(user);
  }

  async createWithPassword(
    email: string,
    username: string,
    password: string,
    role: UserRole = UserRole.PARTICIPANT,
    adminType: string | null = null,
  ): Promise<UserEntity> {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.create(email, username, passwordHash, role, adminType);
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { username } });
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<UserEntity | null> {
    return this.repo.findOne({
      where: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });
  }

  async findWithPasswordByEmailOrUsername(emailOrUsername: string): Promise<UserWithPasswordHash | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :emailOrUsername OR user.username = :emailOrUsername', { emailOrUsername })
      .getOne() as Promise<UserWithPasswordHash | null>;
  }

  async findRawByEmailOrUsername(emailOrUsername: string): Promise<RawUserRow | null> {
    const rows = await this.repo.query(
      `SELECT id, email, username, password_hash, role, banned,
              "warningCount", "profilePicUrl", bio, "createdAt", "updatedAt"
       FROM users
       WHERE email = $1 OR username = $1
       LIMIT 1`,
      [emailOrUsername],
    );
    return rows[0] ?? null;
  }

  async findAll(): Promise<UserEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  // ─── Existence Checks ──────────────────────────────────────────────────────

  async emailExists(email: string): Promise<boolean> {
    return this.repo.exists({ where: { email } });
  }

  async usernameExists(username: string): Promise<boolean> {
    return this.repo.exists({ where: { username } });
  }

  // ─── Updates ───────────────────────────────────────────────────────────────

  async update(id: string, updates: Partial<UserEntity>): Promise<UserEntity> {
    await this.repo.update(id, updates);
    return this.repo.findOne({ where: { id } });
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await this.repo.update(id, { passwordHash: newPasswordHash });
  }

  async ensureDemoAccount(account: {
    email: string;
    username: string;
    password: string;
    role: UserRole;
    adminType?: string;
  }): Promise<void> {
    const existing = await this.findWithPasswordByEmailOrUsername(account.email);
    if (!existing) {
      await this.createWithPassword(
        account.email,
        account.username,
        account.password,
        account.role,
        account.adminType,
      );
      console.log(`Seeded user: ${account.email} (${account.adminType || account.role})`);
      return;
    }

    const updates: Partial<UserEntity> = {
      username: existing.username || account.username,
    };

    if (!existing.passwordHash) {
      updates.passwordHash = await bcrypt.hash(account.password, 10);
    }

    await this.repo.update(existing.id, updates);
  }

  async banUser(usernameOrEmail: string): Promise<boolean> {
    const user = await this.findByEmailOrUsername(usernameOrEmail);
    if (!user) return false;
    await this.repo.update(user.id, { banned: true });
    return true;
  }

  async unbanUser(usernameOrEmail: string): Promise<boolean> {
    const user = await this.findByEmailOrUsername(usernameOrEmail);
    if (!user) return false;
    await this.repo.update(user.id, { banned: false, warningCount: 0 });
    return true;
  }

  async incrementWarning(usernameOrEmail: string): Promise<{ warningCount: number; banned: boolean }> {
    const user = await this.findByEmailOrUsername(usernameOrEmail);
    if (!user) throw new NotFoundException('User not found');

    const newCount = (user.warningCount || 0) + 1;
    const banned = newCount >= 3;
    await this.repo.update(user.id, { warningCount: newCount, banned });
    return { warningCount: newCount, banned };
  }

  async isBanned(usernameOrEmail: string): Promise<boolean> {
    const user = await this.findByEmailOrUsername(usernameOrEmail);
    return user?.banned === true;
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async seedDemoAccounts(): Promise<void> {
    const demoAccounts = [
      { email: 'regular@nexus.gg', username: 'regular@nexus.gg', password: 'regular123', role: UserRole.PARTICIPANT, adminType: null },
      { email: 'admin@nexus.gg', username: 'admin@nexus.gg', password: 'admin123', role: UserRole.COMP_ADMIN, adminType: 'comp_admin' },
      { email: 'dispute_admin@nexus.gg', username: 'dispute_admin@nexus.gg', password: 'admin123', role: UserRole.DISPUTE_ADMIN, adminType: 'dispute_admin' },
      { email: 'revenue_admin@nexus.gg', username: 'revenue_admin@nexus.gg', password: 'admin123', role: UserRole.REVENUE_ADMIN, adminType: 'revenue_admin' },
      { email: 'superadmin@nexus.gg', username: 'superadmin@nexus.gg', password: 'super123', role: UserRole.SUPER_ADMIN, adminType: 'super_admin' },
    ];

    for (const acc of demoAccounts) {
      await this.ensureDemoAccount(acc);
    }
  }
}
