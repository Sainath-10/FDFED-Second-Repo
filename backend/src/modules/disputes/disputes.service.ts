import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DisputeRepository } from './repositories/dispute.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import {
  CreateDisputeDto,
  OrganizerReviewDisputeDto,
  AdminResolveDisputeDto,
} from './dto/dispute.dto';
import { IDispute, DisputeStatus, DisputeTargetType } from '../../common/interfaces';

@Injectable()
export class DisputesService {
  constructor(
    private disputeRepository: DisputeRepository,
    private competitionRepository: CompetitionRepository,
    private userRepository: UserRepository,
  ) {}

  // ─── Player Creates Dispute ───────────────────────────────────────────────────
  async createDispute(dto: CreateDisputeDto, reportedBy: string = 'anonymous'): Promise<IDispute> {
    const { competitionId, matchId, teamId, targetType, targetUserOrTeam, reason, evidenceUrls } = dto;

    const comp = await this.competitionRepository.findById(competitionId);
    const organizers =
      comp?.organizers?.length > 0
        ? comp.organizers
        : comp?.createdBy
        ? [comp.createdBy]
        : ['organizer'];

    // Route: disputes against organizer go directly to platform admin
    const initialStatus =
      targetType === DisputeTargetType.ORGANIZER
        ? DisputeStatus.OPEN_ADMIN
        : DisputeStatus.OPEN_ORGANIZER;

    return this.disputeRepository.create({
      competitionId,
      matchId,
      teamId,
      reportedBy,
      organizers,
      targetType,
      targetUserOrTeam,
      reason,
      evidenceUrls,
      status: initialStatus,
    });
  }

  // ─── Organizer Actions ────────────────────────────────────────────────────────
  async organizerReviewDispute(
    id: string,
    dto: OrganizerReviewDisputeDto,
    organizerUsername: string,
  ): Promise<IDispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);

    if (dispute.status !== DisputeStatus.OPEN_ORGANIZER && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new ForbiddenException('This dispute is not in the organizer queue');
    }

    const updates: Partial<IDispute> = { organizerNotes: dto.notes };

    if (dto.action === 'resolve') {
      updates.status = DisputeStatus.RESOLVED;
      updates.resolvedBy = organizerUsername;
    } else {
      // escalate_to_admin
      updates.status = DisputeStatus.ESCALATED_TO_ADMIN;
      updates.banRequested = dto.requestBan ?? false;
    }

    return this.disputeRepository.update(id, updates);
  }

  // ─── Admin Actions ─────────────────────────────────────────────────────────────
  async adminResolveDispute(
    id: string,
    dto: AdminResolveDisputeDto,
    adminUsername: string,
  ): Promise<IDispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);

    if (
      dispute.status !== DisputeStatus.OPEN_ADMIN &&
      dispute.status !== DisputeStatus.ESCALATED_TO_ADMIN
    ) {
      throw new ForbiddenException('This dispute is not in the admin queue');
    }

    const updates: Partial<IDispute> = {
      status: DisputeStatus.RESOLVED,
      adminNotes: dto.resolutionNotes,
      resolvedBy: adminUsername,
    };

    if (dto.action === 'resolve_and_ban') {
      const target = dto.targetUsernameToBan || dispute.targetUserOrTeam;
      if (!target) throw new BadRequestException('targetUsernameToBan is required for ban action');

      const banned = await this.userRepository.banUser(target);
      updates.banApplied = banned;
    }

    return this.disputeRepository.update(id, updates);
  }

  // ─── Read Queries ─────────────────────────────────────────────────────────────
  async getDisputeById(id: string): Promise<IDispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);
    return dispute;
  }

  async getAllDisputes(): Promise<IDispute[]> {
    return this.disputeRepository.findAll();
  }

  /** Queue visible to Organizer: open_organizer + under_review */
  async getOrganizerQueue(): Promise<IDispute[]> {
    return this.disputeRepository.findOrganizerQueue();
  }

  /** Queue visible to Platform Admin: open_admin + escalated_to_admin */
  async getAdminQueue(): Promise<IDispute[]> {
    return this.disputeRepository.findAdminQueue();
  }

  async getDisputesByCompetition(competitionId: string): Promise<IDispute[]> {
    return this.disputeRepository.findByCompetition(competitionId);
  }

  async getDisputesByStatus(status: DisputeStatus): Promise<IDispute[]> {
    return this.disputeRepository.findByStatus(status);
  }

  async deleteDispute(id: string): Promise<void> {
    await this.disputeRepository.delete(id);
  }
}
