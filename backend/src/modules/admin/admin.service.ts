import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../auth/repositories/user.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { DisputeRepository } from '../disputes/repositories/dispute.repository';
import { RevenueRepository } from '../revenue/repositories/revenue.repository';
import { CreateAdminDto } from './dto/admin.dto';
import { IUser, UserRole } from '@/common/interfaces';
import { FileLoggerService } from '@/common/logger/file-logger.service';

@Injectable()
export class AdminService {
  constructor(
    private userRepository: UserRepository,
    private competitionRepository: CompetitionRepository,
    private disputeRepository: DisputeRepository,
    private revenueRepository: RevenueRepository,
    private fileLogger: FileLoggerService,
  ) {}

  async getAllUsers(): Promise<IUser[]> {
    return this.userRepository.findAll();
  }

  async createAdminUser(dto: CreateAdminDto): Promise<IUser> {
    const { email, username, firstName, lastName, role = UserRole.ADMIN } = dto;

    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException(`Email ${email} is already registered.`);
    }

    if (await this.userRepository.usernameExists(username)) {
      throw new ConflictException(`Username ${username} is already taken.`);
    }

    const admin = await this.userRepository.create(
      email,
      username,
      firstName,
      lastName,
      role,
    );

    this.fileLogger.log(
      `New admin created: ${username} (${role}) by Super Admin`,
      'AdminService',
      { userId: admin.id, email: admin.email, role: admin.role },
    );

    return admin;
  }

  async updateUserRole(id: string, role: UserRole): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    const updated = await this.userRepository.updateRole(id, role);
    this.fileLogger.log(
      `Role for user ${user.username} updated from ${user.role} to ${role}`,
      'AdminService',
      { userId: id, oldRole: user.role, newRole: role },
    );

    return updated;
  }

  async getAdminStats(): Promise<any> {
    const [allComps, activeComps, totalUsers, openDisputes, escalatedDisputes, resolvedDisputes, revenueStats] = await Promise.all([
      this.competitionRepository.findAll(),
      this.competitionRepository.findByStatus('active'),
      this.userRepository.count(),
      this.disputeRepository.countByStatus('open'),
      this.disputeRepository.countByStatus('escalated'),
      this.disputeRepository.countByStatus('resolved'),
      this.revenueRepository.getRevenueStats(),
    ]);

    const upcomingComps = allComps.filter(c => new Date(c.startDate) > new Date());
    const completedComps = allComps.filter(c => c.status === 'completed');

    return {
      tournaments: {
        total: allComps.length,
        active: activeComps.length,
        upcoming: upcomingComps.length,
        completed: completedComps.length,
      },
      users: {
        total: totalUsers,
      },
      disputes: {
        open: openDisputes,
        escalated: escalatedDisputes,
        resolved: resolvedDisputes,
        total: openDisputes + escalatedDisputes + resolvedDisputes,
      },
      revenue: revenueStats,
    };
  }
}
