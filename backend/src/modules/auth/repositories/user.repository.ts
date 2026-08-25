import { Injectable } from '@nestjs/common';
import { IUser, UserRole } from '@/common/interfaces';

@Injectable()
export class UserRepository {
  private users: Map<string, IUser> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private usernameIndex: Map<string, string> = new Map();
  private nextId = 1;

  constructor() {
    this.seedDemoAccounts();
  }

  private async seedDemoAccounts() {
    const demoAccounts = [
      {
        email: 'regular@nexus.gg',
        username: 'regular@nexus.gg',
        firstName: 'Regular',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
      },
      {
        email: 'admin@nexus.gg',
        username: 'admin@nexus.gg',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
      },
      {
        email: 'superadmin@nexus.gg',
        username: 'superadmin@nexus.gg',
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
      },
    ];

    for (const account of demoAccounts) {
      await this.create(
        account.email,
        account.username,
        account.firstName,
        account.lastName,
        account.role,
      );
    }

    console.log(`✓ Seeded ${demoAccounts.length} demo accounts`);
  }

  async create(
    email: string,
    username: string,
    firstName: string,
    lastName: string,
    role: UserRole = UserRole.PARTICIPANT,
  ): Promise<IUser> {
    const id = String(this.nextId++);

    const user: IUser = {
      id,
      email,
      username,
      firstName,
      lastName,
      role,
      createdAt: new Date(),
    };

    this.users.set(id, user);
    this.emailIndex.set(email, id);
    this.usernameIndex.set(username, id);

    return user;
  }

  async findById(id: string): Promise<IUser | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const userId = this.emailIndex.get(email);
    return userId ? this.users.get(userId) || null : null;
  }

  async findByUsername(username: string): Promise<IUser | null> {
    const userId = this.usernameIndex.get(username);
    return userId ? this.users.get(userId) || null : null;
  }

  async findByEmailOrUsername(
    emailOrUsername: string,
  ): Promise<IUser | null> {
    const userByEmail = await this.findByEmail(emailOrUsername);
    if (userByEmail) return userByEmail;

    return await this.findByUsername(emailOrUsername);
  }

  async findAll(): Promise<IUser[]> {
    return Array.from(this.users.values());
  }

  async delete(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    this.emailIndex.delete(user.email);
    this.usernameIndex.delete(user.username);
    this.users.delete(id);

    return true;
  }

  async emailExists(email: string): Promise<boolean> {
    return this.emailIndex.has(email);
  }

  async usernameExists(username: string): Promise<boolean> {
    return this.usernameIndex.has(username);
  }
}
