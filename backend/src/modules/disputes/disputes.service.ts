import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { DisputeRepository } from './repositories/dispute.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { TeamRepository } from '../teams/repositories/team.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import { CreateDisputeDto, OrganizerReviewDisputeDto, AdminResolveDisputeDto } from './dto/dispute.dto';
import { IDispute, DisputeStatus, DisputeTargetType, UserRole } from '../../common/interfaces';

/** Staff who may read every dispute. */
const STAFF = new Set<string>([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR]);
/** Staff who may resolve any open dispute (this is what unblocks settlement). */
const RESOLVERS = new Set<string>([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR]);

const lc = (v: unknown) => String(v ?? '').trim().toLowerCase();
const isStaffUser = (user: any) => STAFF.has(lc(user?.role)) || STAFF.has(lc(user?.adminType));
const canResolveAny = (user: any) => RESOLVERS.has(lc(user?.role)) || RESOLVERS.has(lc(user?.adminType));

/** Competition states after which no new result dispute can be raised. */
const CLOSED_STATES = new Set(['CANCELLED', 'REFUND_ISSUED', 'EXPIRED', 'REVERSED']);

@Injectable()
export class DisputesService {
  constructor(
    private disputeRepository: DisputeRepository,
    private competitionRepository: CompetitionRepository,
    private teamRepository: TeamRepository,
    private userRepository: UserRepository,
    private notificationsService: NotificationsService,
    private auditLog: AuditLogService,
    private config: ConfigService,
  ) {}

  private organizersOf(comp: any): string[] {
    return Array.from(new Set([comp?.createdBy, ...(comp?.organizers || [])].filter(Boolean).map(String)));
  }

  private isOrganizer(comp: any, user: any) {
    const me = lc(user?.username);
    return !!me && this.organizersOf(comp).some((o) => lc(o) === me);
  }

  /** When the post-competition dispute window closes, or null if the competition has not ended. */
  private disputeWindowEndsAt(comp: any): Date | null {
    if (!comp?.endedAt) return null;
    const hours = Number(this.config.get('DISPUTE_WINDOW_HOURS', 24));
    return new Date(+new Date(comp.endedAt) + hours * 3600000);
  }

  private async findCompetitionOr404(id: string) {
    const comp = isUUID(String(id || '')) ? await this.competitionRepository.findById(id) : null;
    if (!comp) throw new NotFoundException('That competition could not be found.');
    return comp;
  }

  // ─── Player creates a dispute ────────────────────────────────────────────────
  async createDispute(dto: CreateDisputeDto, user: any): Promise<IDispute> {
    const reportedBy = String(user?.username || '').trim();
    if (!reportedBy) throw new ForbiddenException('Sign in to raise a dispute.');
    const { competitionId, matchId, teamId, targetType, reason, evidenceUrls, category } = dto;
    const targetUserOrTeam = dto.targetUserOrTeam.trim();

    const comp = await this.findCompetitionOr404(competitionId);
    const teams = await this.teamRepository.findByCompetition(comp.id);
    const me = lc(reportedBy);

    // Only people taking part can dispute a competition's results.
    const myTeam = teams.find((t) => (t.memberUsernames || []).some((m) => lc(m) === me));
    if (!myTeam && !isStaffUser(user)) {
      throw new ForbiddenException('Only players registered in this competition can raise a dispute about it.');
    }
    if (this.isOrganizer(comp, user)) {
      throw new ForbiddenException('Organizers resolve disputes in their competition; they cannot raise one.');
    }

    if (teamId) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) throw new BadRequestException('That team is not part of this competition.');
    }
    if (matchId && !isUUID(matchId)) throw new BadRequestException('That match id is not valid.');
    if (targetType === DisputeTargetType.OPPONENT_TEAM) {
      const target = teams.find((t) => lc(t.name) === lc(targetUserOrTeam) || t.id === targetUserOrTeam);
      if (!target) throw new BadRequestException(`No team called "${targetUserOrTeam}" is registered in this competition.`);
      if (myTeam && target.id === myTeam.id) throw new BadRequestException('You cannot raise a dispute against your own team.');
    }

    // Dispute window: open while the competition runs and until the window after "End competition" closes.
    const status = String(comp.paymentStatus || '').toUpperCase();
    const prizeComplaint = category === 'prize_not_received';
    if (CLOSED_STATES.has(status) || lc(comp.status) === 'cancelled') {
      throw new BadRequestException('This competition was cancelled or reversed, so disputes are closed.');
    }
    if (status === 'PRIZE_RELEASED' && !prizeComplaint) {
      throw new BadRequestException('Prizes for this competition were already released. Use "Prize not received" if you were not paid.');
    }
    const until = this.disputeWindowEndsAt(comp);
    if (status === 'COMPLETED' && until && Date.now() > +until && !prizeComplaint) {
      throw new BadRequestException(`The dispute window closed on ${until.toUTCString()}.`);
    }

    const organizers = this.organizersOf(comp);
    const initialStatus =
      targetType === DisputeTargetType.ORGANIZER ? DisputeStatus.OPEN_ADMIN : DisputeStatus.OPEN_ORGANIZER;

    const dispute = await this.disputeRepository.create({
      competitionId: comp.id,
      matchId,
      teamId: teamId || myTeam?.id,
      reportedBy,
      organizers,
      targetType,
      targetUserOrTeam,
      reason: reason.trim(),
      evidenceUrls,
      category: category || undefined,
      status: initialStatus,
    });

    await this.auditLog.record('DISPUTE_CREATED', {
      actor: reportedBy,
      entityType: 'dispute',
      entityId: dispute.id,
      details: `${category || targetType} dispute filed in "${comp.name}".`,
      metadata: { targetType, category: category || null, competitionId: comp.id },
    });

    const staff = (await this.userRepository.findAll()).filter((u) => !u.banned && isStaffUser(u));
    staff.forEach((admin) => {
      this.notificationsService.create({
        toUsername: admin.username,
        type: prizeComplaint ? 'prize-dispute' : 'dispute-created',
        status: 'pending',
        title: prizeComplaint ? 'Prize Not Received report' : 'New dispute filed',
        body: `@${reportedBy} filed a ${category || targetType.replace(/_/g, ' ')} dispute in "${comp.name}".`,
        meta: { compId: comp.id, disputeId: dispute.id, category: category || null },
      }).catch(() => {});
    });

    if (targetType !== DisputeTargetType.ORGANIZER) {
      organizers.forEach((organizer) => {
        this.notificationsService.create({
          toUsername: organizer,
          type: 'dispute-created',
          status: 'pending',
          title: 'New dispute in your competition',
          body: `@${reportedBy} raised a dispute in "${comp.name}". Open the competition's Disputes tab to review it.`,
          meta: { compId: comp.id, disputeId: dispute.id },
        }).catch(() => {});
      });
    }

    return dispute;
  }

  private async notifyReporter(dispute: IDispute, notes?: string) {
    if (!dispute.reportedBy) return;
    const label = String(dispute.status).replace(/_/g, ' ');
    this.notificationsService.create({
      toUsername: dispute.reportedBy,
      type: 'dispute-status',
      status: dispute.status === DisputeStatus.RESOLVED ? 'approved' : 'pending',
      title: 'Dispute status updated',
      body: `Your dispute is now "${label}".${notes ? ` Notes: ${notes}` : ''}`,
      meta: { compId: dispute.competitionId, disputeId: dispute.id },
    }).catch(() => {});
  }

  // ─── Organizer review (resolve or escalate) ──────────────────────────────────
  async organizerReviewDispute(id: string, dto: OrganizerReviewDisputeDto, user: any): Promise<IDispute> {
    const dispute = await this.getDisputeOr404(id);
    const comp = await this.competitionRepository.findById(dispute.competitionId);
    if (!this.isOrganizer(comp, user) && !canResolveAny(user)) {
      throw new ForbiddenException('Only an organizer of this competition (or platform staff) can review its disputes.');
    }
    if (lc(dispute.reportedBy) === lc(user?.username)) {
      throw new ForbiddenException('You cannot review a dispute you raised.');
    }
    if (dispute.status !== DisputeStatus.OPEN_ORGANIZER && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException('This dispute is not waiting for the organizer.');
    }

    const actor = user?.username || 'organizer';
    const updates: Partial<IDispute> = { organizerNotes: dto.notes.trim() };
    if (dto.action === 'resolve') {
      updates.status = DisputeStatus.RESOLVED;
      updates.resolvedBy = actor;
    } else {
      updates.status = DisputeStatus.ESCALATED_TO_ADMIN;
      updates.banRequested = dto.requestBan ?? false;
    }

    const updated = await this.disputeRepository.update(id, updates);
    await this.auditLog.record('DISPUTE_ORGANIZER_REVIEW', {
      actor,
      entityType: 'dispute',
      entityId: id,
      details: `Organizer action: ${dto.action}.`,
      metadata: { status: updated.status, requestBan: !!dto.requestBan },
    });
    if (updated.status === DisputeStatus.ESCALATED_TO_ADMIN) {
      const staff = (await this.userRepository.findAll()).filter((u) => !u.banned && canResolveAny(u));
      staff.forEach((admin) =>
        this.notificationsService.create({
          toUsername: admin.username,
          type: 'dispute-escalated',
          status: 'pending',
          title: 'Dispute escalated to platform staff',
          body: `@${actor} escalated a dispute in "${comp?.name || 'a competition'}".`,
          meta: { compId: dispute.competitionId, disputeId: id },
        }).catch(() => {}),
      );
    }
    await this.notifyReporter(updated, dto.notes);
    return updated;
  }

  // ─── Platform staff resolves (optionally bans) ────────────────────────────────
  async adminResolveDispute(id: string, dto: AdminResolveDisputeDto, user: any): Promise<IDispute> {
    if (!canResolveAny(user)) throw new ForbiddenException('Platform staff access is required.');
    const dispute = await this.getDisputeOr404(id);
    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new BadRequestException('This dispute is already resolved.');
    }
    const comp = await this.competitionRepository.findById(dispute.competitionId);
    if (comp && this.isOrganizer(comp, user)) {
      throw new ForbiddenException('Conflict of interest: you organize this competition.');
    }

    const actor = user?.username || 'admin';
    const updates: Partial<IDispute> = {
      status: DisputeStatus.RESOLVED,
      adminNotes: dto.resolutionNotes.trim(),
      resolvedBy: actor,
    };

    if (dto.action === 'resolve_and_ban') {
      const roles = [lc(user?.role), lc(user?.adminType)];
      if (!roles.includes(UserRole.ADMIN) && !roles.includes(UserRole.SUPER_ADMIN)) {
        throw new ForbiddenException('Only an administrator can ban an account.');
      }
      const target = String(dto.targetUsernameToBan || '').trim().replace(/^@/, '');
      if (!target) throw new BadRequestException('Enter the username to ban.');
      const account = await this.userRepository.findByUsername(target);
      if (!account) throw new BadRequestException(`No account called @${target}.`);
      if (account.role === UserRole.SUPER_ADMIN || account.adminType === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Super Admin accounts cannot be banned.');
      }
      updates.banApplied = await this.userRepository.banUser(account.username);
    }

    const updated = await this.disputeRepository.update(id, updates);
    await this.auditLog.record('ADMIN_RESOLVED', {
      actor,
      entityType: 'dispute',
      entityId: id,
      details: `Staff action: ${dto.action}.`,
      metadata: { status: updated.status, banApplied: !!updated.banApplied },
    });
    await this.notifyReporter(updated, dto.resolutionNotes);
    return updated;
  }

  /**
   * The player who raised a dispute sends it to platform staff when the
   * organizer has not acted within 24 hours, or when they disagree with the
   * organizer's resolution. Staff decisions are final and cannot be escalated.
   */
  async escalateByReporter(id: string, reason: string, user: any) {
    const dispute = await this.getDisputeOr404(id);
    if (lc(dispute.reportedBy) !== lc(user?.username)) {
      throw new ForbiddenException('Only the player who raised this dispute can escalate it.');
    }
    const waitingOnOrganizer = [DisputeStatus.OPEN_ORGANIZER, DisputeStatus.UNDER_REVIEW].includes(dispute.status as DisputeStatus);
    const organizerResolved = dispute.status === DisputeStatus.RESOLVED && !!dispute.organizerNotes && !dispute.adminNotes;
    if (!waitingOnOrganizer && !organizerResolved) {
      throw new BadRequestException('This dispute is already with platform staff or was decided by them.');
    }
    if (waitingOnOrganizer && Date.now() - +new Date(dispute.createdAt) < 24 * 3600000) {
      throw new BadRequestException('Give the organizer 24 hours to respond before escalating.');
    }
    const updated = await this.disputeRepository.update(id, {
      status: DisputeStatus.ESCALATED_TO_ADMIN,
      resolvedBy: null,
      adminNotes: null,
      organizerNotes: [dispute.organizerNotes, `Escalated by @${user.username}: ${reason.trim()}`].filter(Boolean).join('\n'),
    } as any);
    await this.auditLog.record('DISPUTE_ESCALATED_BY_PLAYER', {
      actor: user.username,
      entityType: 'dispute',
      entityId: id,
      details: reason.trim(),
    });
    const comp = await this.competitionRepository.findById(dispute.competitionId);
    const staff = (await this.userRepository.findAll()).filter((u) => !u.banned && canResolveAny(u));
    staff.forEach((admin) =>
      this.notificationsService.create({
        toUsername: admin.username,
        type: 'dispute-escalated',
        status: 'pending',
        title: 'Player escalated a dispute',
        body: `@${user.username} escalated a dispute in "${comp?.name || 'a competition'}": ${reason.trim()}`,
        meta: { compId: dispute.competitionId, disputeId: id },
      }).catch(() => {}),
    );
    return updated;
  }

  // ─── Reads ────────────────────────────────────────────────────────────────────
  private async getDisputeOr404(id: string) {
    const dispute = isUUID(String(id || '')) ? await this.disputeRepository.findById(id) : null;
    if (!dispute) throw new NotFoundException('Dispute not found.');
    return dispute;
  }

  /** Reporter, members of the teams involved, the competition's organizers, and staff. */
  private async canRead(dispute: IDispute, user: any, comp?: any): Promise<boolean> {
    if (isStaffUser(user)) return true;
    const me = lc(user?.username);
    if (!me) return false;
    if (lc(dispute.reportedBy) === me) return true;
    const competition = comp || (await this.competitionRepository.findById(dispute.competitionId));
    if (this.isOrganizer(competition, user)) return true;
    const teams = await this.teamRepository.findByCompetition(dispute.competitionId);
    const involved = teams.filter(
      (t) => t.id === dispute.teamId || lc(t.name) === lc(dispute.targetUserOrTeam) || t.id === dispute.targetUserOrTeam,
    );
    return involved.some((t) => (t.memberUsernames || []).some((m) => lc(m) === me));
  }

  async getDisputeById(id: string, user: any) {
    const dispute = await this.getDisputeOr404(id);
    const comp = await this.competitionRepository.findById(dispute.competitionId);
    if (!(await this.canRead(dispute, user, comp))) {
      throw new ForbiddenException('You do not have access to this dispute.');
    }
    return {
      ...dispute,
      competitionName: comp?.name || null,
      canOrganizerReview:
        (this.isOrganizer(comp, user) || canResolveAny(user)) &&
        [DisputeStatus.OPEN_ORGANIZER, DisputeStatus.UNDER_REVIEW].includes(dispute.status as DisputeStatus),
      canAdminResolve: canResolveAny(user) && dispute.status !== DisputeStatus.RESOLVED && !this.isOrganizer(comp, user),
    };
  }

  private async withCompetitionNames(disputes: IDispute[]) {
    const ids = Array.from(new Set(disputes.map((d) => d.competitionId)));
    const names = new Map<string, string>();
    for (const cid of ids) {
      const comp = isUUID(cid) ? await this.competitionRepository.findById(cid) : null;
      if (comp) names.set(cid, comp.name);
    }
    return disputes.map((d) => ({ ...d, competitionName: names.get(d.competitionId) || null }));
  }

  async getAllDisputes() {
    return this.withCompetitionNames(await this.disputeRepository.findAll());
  }

  /** Disputes waiting for an organizer: only competitions the caller organizes (staff see all). */
  async getOrganizerQueue(user: any) {
    const queue = await this.disputeRepository.findOrganizerQueue();
    if (canResolveAny(user)) return this.withCompetitionNames(queue);
    const mine: IDispute[] = [];
    const cache = new Map<string, any>();
    for (const d of queue) {
      if (!cache.has(d.competitionId)) cache.set(d.competitionId, await this.competitionRepository.findById(d.competitionId));
      if (this.isOrganizer(cache.get(d.competitionId), user)) mine.push(d);
    }
    return this.withCompetitionNames(mine);
  }

  /** Disputes needing platform staff: organizer-targeted and escalated ones. */
  async getAdminQueue() {
    return this.withCompetitionNames(await this.disputeRepository.findAdminQueue());
  }

  /** Disputes the caller raised or that involve their teams. */
  async getMyDisputes(user: any) {
    const me = lc(user?.username);
    const all = await this.disputeRepository.findAll();
    const teams = await this.teamRepository.findAll();
    const myTeams = teams.filter((t) => (t.memberUsernames || []).some((m) => lc(m) === me));
    const myTeamIds = new Set(myTeams.map((t) => t.id));
    const myTeamNames = new Set(myTeams.map((t) => `${t.competitionId}:${lc(t.name)}`));
    const mine = all.filter(
      (d) =>
        lc(d.reportedBy) === me ||
        (d.teamId && myTeamIds.has(d.teamId)) ||
        myTeamNames.has(`${d.competitionId}:${lc(d.targetUserOrTeam)}`),
    );
    return this.withCompetitionNames(mine);
  }

  /** Organizers and staff see every dispute in the competition; players see the ones they can read. */
  async getDisputesByCompetition(competitionId: string, user: any) {
    const comp = await this.findCompetitionOr404(competitionId);
    const disputes = await this.disputeRepository.findByCompetition(comp.id);
    if (isStaffUser(user) || this.isOrganizer(comp, user)) {
      return disputes.map((d) => ({ ...d, competitionName: comp.name }));
    }
    const visible: IDispute[] = [];
    for (const d of disputes) if (await this.canRead(d, user, comp)) visible.push(d);
    return visible.map((d) => ({ ...d, competitionName: comp.name }));
  }

  async getDisputesByStatus(status: DisputeStatus) {
    return this.withCompetitionNames(await this.disputeRepository.findByStatus(status));
  }

  async deleteDispute(id: string): Promise<void> {
    await this.getDisputeOr404(id);
    await this.disputeRepository.delete(id);
  }
}
