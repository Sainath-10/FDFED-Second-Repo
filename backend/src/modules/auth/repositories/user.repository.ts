import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../../entities/user.entity';
import { UserRole } from '../../../common/interfaces';

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
    firstName: string,
    lastName: string,
    passwordHash: string,
    role: UserRole = UserRole.PARTICIPANT,
  ): Promise<UserEntity> {
    const user = this.repo.create({
      email,
      username,
      firstName,
      lastName,
      passwordHash,
      role,
      banned: false,
      warningCount: 0,
    });
    return this.repo.save(user);
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

  // ─── Seeding ───────────────────────────────────────────────────────────────

  async seedDemoAccounts(): Promise<void> {
    const demoAccounts = [
      { email: 'regular@nexus.gg', username: 'regular@nexus.gg', firstName: 'Regular', lastName: 'User', password: 'regular123', role: UserRole.PARTICIPANT },
      { email: 'admin@nexus.gg', username: 'admin@nexus.gg', firstName: 'Admin', lastName: 'User', password: 'admin123', role: UserRole.ADMIN },
      { email: 'superadmin@nexus.gg', username: 'superadmin@nexus.gg', firstName: 'Super', lastName: 'Admin', password: 'super123', role: UserRole.SUPER_ADMIN },
    ];

    for (const acc of demoAccounts) {
      const exists = await this.emailExists(acc.email);
      if (!exists) {
        const hash = await bcrypt.hash(acc.password, 10);
        await this.create(acc.email, acc.username, acc.firstName, acc.lastName, hash, acc.role);
        console.log(`✓ Seeded user: ${acc.email}`);
      }
    }
  }
}
