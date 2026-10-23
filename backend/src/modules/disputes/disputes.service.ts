import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DisputeRepository } from './repositories/dispute.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
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
    private notificationsService: NotificationsService,
    private auditLog: AuditLogService,
  ) {}

  // ─── Player Creates Dispute ───────────────────────────────────────────────────
  async createDispute(dto: CreateDisputeDto, reportedBy: string = 'anonymous'): Promise<IDispute> {
    const { competitionId, matchId, teamId, targetType, targetUserOrTeam, reason, evidenceUrls, category } = dto;

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

    const dispute = await this.disputeRepository.create({
      competitionId,
      matchId,
      teamId,
      reportedBy,
      organizers,
      targetType,
      targetUserOrTeam,
      reason,
      evidenceUrls,
      category: category || undefined,
      status: initialStatus,
    });

    await this.auditLog.record('DISPUTE_CREATED', {
      actor: reportedBy,
      entityType: 'dispute',
      entityId: (dispute as any).id,
      details: `${category || targetType} dispute filed in competition ${competitionId}.`,
      metadata: { targetType, category: category || null },
    });

    // §13.3/§14 — notify the support/admin review team (resolved from real
    // accounts by role, never hardcoded usernames).
    const supportRoles = new Set(['dispute_admin', 'admin', 'super_admin', 'comp_admin']);
    const staff = (await this.userRepository.findAll()).filter((u) => supportRoles.has(String((u as any).role || '').toLowerCase()));
    staff.forEach((admin) => {
      this.notificationsService.create({
        toUsername: admin.username,
        type: category === 'prize_not_received' ? 'prize-dispute' : 'dispute-created',
        status: 'pending',
        title: category === 'prize_not_received' ? '💰 Prize Not Received report' : '⚠ New dispute filed',
        body: `@${reportedBy} filed a ${category || targetType} report in competition ${competitionId}.`,
        meta: { compId: competitionId, disputeId: (dispute as any).id, category: category || null },
      }).catch(() => {});
    });

    // Organizers also need visibility for participant/team disputes (not
    // organizer-targeted ones, which go straight to platform review).
    if (targetType !== DisputeTargetType.ORGANIZER) {
      organizers.forEach((organizer) => {
        this.notificationsService.create({
          toUsername: organizer,
          type: 'dispute-created',
          status: 'pending',
          title: '⚠ New dispute filed',
          body: `A ${targetType} dispute was filed in your competition ${competitionId}.`,
          meta: { compId: competitionId, disputeId: (dispute as any).id },
        }).catch(() => {});
      });
    }

    return dispute;
  }

  private async notifyReporter(dispute: IDispute, status: string, notes?: string) {
    if (!dispute.reportedBy) return;
    this.notificationsService.create({
      toUsername: dispute.reportedBy,
      type: 'dispute-status',
      status,
      title: 'Dispute status updated',
      body: `Your dispute in competition ${dispute.competitionId} is now "${status}". ${notes || ''}`.trim(),
      meta: { compId: dispute.competitionId, disputeId: (dispute as any).id },
    }).catch(() => {});
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
      if (dispute.targetType === DisputeTargetType.OPPONENT_TEAM) {
        throw new BadRequestException('Team disputes must be handled by the organizer with warnings or a team ban.');
      }
      // escalate_to_admin
      updates.status = DisputeStatus.ESCALATED_TO_ADMIN;
      updates.banRequested = dto.requestBan ?? false;
    }

    const updated = await this.disputeRepository.update(id, updates);
    await this.auditLog.record('DISPUTE_ORGANIZER_REVIEW', {
      actor: organizerUsername,
      entityType: 'dispute',
      entityId: id,
      details: `Organizer action: ${dto.action}.`,
      metadata: { status: updated.status, requestBan: !!dto.requestBan },
    });
    await this.notifyReporter(updated, updated.status, dto.notes);
    return updated;
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

    const updated = await this.disputeRepository.update(id, updates);
    await this.auditLog.record('DISPUTE_ADMIN_RESOLVED', {
      actor: adminUsername,
      entityType: 'dispute',
      entityId: id,
      details: `Admin action: ${dto.action}.`,
      metadata: { status: updated.status, banApplied: !!updated.banApplied },
    });
    await this.notifyReporter(updated, updated.status, dto.resolutionNotes);
    return updated;
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
