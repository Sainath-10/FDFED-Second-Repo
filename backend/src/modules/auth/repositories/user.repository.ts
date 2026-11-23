import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../../entities/user.entity';
import { UserRole } from '../../../common/interfaces';

export type UserWithPasswordHash = UserEntity & { passwordHash: string };

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
      email: String(email).trim().toLowerCase(),
      username: String(username).trim(),
      passwordHash,
      role,
      adminType: adminType || (role === UserRole.SUPER_ADMIN ? 'super_admin' : null),
      banned: false,
      warningCount: 0,
    });
    const saved = await this.repo.save(user);
    return UserRepository.withoutSecrets(saved);
  }

  /** Never hand a password hash back to a caller that might serialise it. */
  static withoutSecrets<T extends Partial<UserEntity>>(user: T): T {
    if (!user) return user;
    const { passwordHash: _hash, ...rest } = user as any;
    return rest as T;
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

  async findWithPasswordById(id: string): Promise<UserWithPasswordHash | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne() as Promise<UserWithPasswordHash | null>;
  }

  /** Emails and usernames are compared case-insensitively everywhere. */
  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('lower(user.email) = lower(:email)', { email: String(email || '').trim() })
      .getOne();
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('lower(user.username) = lower(:username)', { username: String(username || '').trim() })
      .getOne();
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<UserEntity | null> {
    const value = String(emailOrUsername || '').trim();
    return this.repo
      .createQueryBuilder('user')
      .where('lower(user.email) = lower(:value) OR lower(user.username) = lower(:value)', { value })
      .getOne();
  }

  async findWithPasswordByEmailOrUsername(emailOrUsername: string): Promise<UserWithPasswordHash | null> {
    const value = String(emailOrUsername || '').trim();
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = lower(:value) OR lower(user.username) = lower(:value)', { value })
      .getOne() as Promise<UserWithPasswordHash | null>;
  }

  async findAll(): Promise<UserEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  // ─── Existence Checks ──────────────────────────────────────────────────────

  async emailExists(email: string): Promise<boolean> {
    return !!(await this.findByEmail(email));
  }

  async usernameExists(username: string): Promise<boolean> {
    return !!(await this.findByUsername(username));
  }

  // ─── Updates ───────────────────────────────────────────────────────────────

  async update(id: string, updates: Partial<UserEntity>): Promise<UserEntity> {
    await this.repo.update(id, updates);
    return this.repo.findOne({ where: { id } });
  }

  async setBanned(id: string, banned: boolean): Promise<void> {
    await this.repo.update(id, banned ? { banned: true } : { banned: false, warningCount: 0 });
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
    const password = 'nexus';

    const demoAccounts = [
      { email: 'superadmin@nexus.gg', username: 'superadmin', password: 'super123', role: UserRole.SUPER_ADMIN, adminType: 'super_admin' },
      { email: 'regular@nexus.gg', username: 'regular', password: 'regular123', role: UserRole.PARTICIPANT, adminType: null },
      { email: 'superadmin1@nexus.gg', username: 'superadmin1', password, role: UserRole.SUPER_ADMIN, adminType: 'super_admin' },
      { email: 'superadmin2@nexus.gg', username: 'superadmin2', password, role: UserRole.SUPER_ADMIN, adminType: 'super_admin' },
      { email: 'communitymod@nexus.gg', username: 'communitymod', password, role: UserRole.COMMUNITY_MODERATOR, adminType: 'community_moderator' },
      { email: 'finance@nexus.gg', username: 'finance', password, role: UserRole.FINANCE_MODERATOR, adminType: 'finance_moderator' },
      { email: 'regular1@nexus.gg', username: 'regular1', password, role: UserRole.PARTICIPANT, adminType: null },
      { email: 'regular2@nexus.gg', username: 'regular2', password, role: UserRole.PARTICIPANT, adminType: null },
      { email: 'regular3@nexus.gg', username: 'regular3', password, role: UserRole.PARTICIPANT, adminType: null },
    ];

    for (const acc of demoAccounts) {
      await this.ensureDemoAccount(acc);
    }
  }
}
