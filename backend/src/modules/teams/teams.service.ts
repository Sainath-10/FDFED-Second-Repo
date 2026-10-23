import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamRepository } from './repositories/team.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import { RefundRequestEntity } from '../../entities/refund-request.entity';
import { RevenueTransactionEntity } from '../../entities/revenue-transaction.entity';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';
import { ITeam, UserRole } from '../../common/interfaces';
import { isCompetitionStarted } from '../../common/validation/competition.rules';

@Injectable()
export class TeamsService {
  constructor(
    private teamRepository: TeamRepository,
    private competitionRepository: CompetitionRepository,
    private userRepository: UserRepository,
    private notificationsService: NotificationsService,
    private auditLog: AuditLogService,
    @InjectRepository(RefundRequestEntity)
    private refundRepo: Repository<RefundRequestEntity>,
    @InjectRepository(RevenueTransactionEntity)
    private revenueRepo: Repository<RevenueTransactionEntity>,
  ) {}

  async verifyTeamOwnership(teamId: string, user: any): Promise<ITeam> {
    const team = await this.getTeamById(teamId);
    if (!user) {
      throw new ForbiddenException('User context required');
    }
    const role = user.role;
    if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
      return team;
    }
    const currentUsername = (user.username || user.id || '').toLowerCase();
    const leaderId = (team.leaderId || '').toLowerCase();
    const createdBy = (team.createdBy || '').toLowerCase();
    const leaderUsername = ((team as any).leaderUsername || '').toLowerCase();

    if (currentUsername !== leaderId && currentUsername !== createdBy && currentUsername !== leaderUsername) {
      throw new ForbiddenException('Only the team captain or an administrator can manage this team');
    }
    return team;
  }

  /**
   * Mock-verification gate (§12.4). Backend-enforced for every joining path:
   * team creation, member add, invite acceptance and join-request approval.
   */
  private async assertVerified(user: any, context: string) {
    const authUserId = user?.id;
    const byId = authUserId ? await this.userRepository.findById(authUserId) : null;
    const verifier = byId
      ? String(byId.verificationStatus || '').toLowerCase()
      : null;
    if (verifier !== 'verified') {
      throw new ForbiddenException(
        `Simulated Aadhaar verification is required before you can ${context}. Open your Profile → Verification to complete the (simulated) verification flow.`,
      );
    }
  }

  /** Authoritative persisted payment record check (§6.1). */
  private async participantHasPaid(competitionId: string, username: string): Promise<boolean> {
    if (!competitionId || !username) return false;
    return this.revenueRepo.exists({
      where: {
        competitionId,
        status: 'CONFIRMED',
        organizerName: username,
      },
    });
  }

  async createTeam(createTeamDto: CreateTeamDto, user: any): Promise<ITeam> {
    const { name, competitionId, members, joinCode } = createTeamDto;
    const leaderId = user?.username || user?.id || 'system';

    // §12.4 — unverified users cannot join/create through direct API requests
    await this.assertVerified(user, 'create a team for a competition');

    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${competitionId} not found`);
    }
    if (competition.approvalStatus && competition.approvalStatus !== 'approved') {
      throw new ForbiddenException('This competition is not accepting team registrations.');
    }

    // §2.4 — private competitions require a valid join code; public never do
    if (competition.visibility === 'private') {
      const code = String(joinCode || '').trim().toUpperCase();
      if (!competition.joinCode || code !== String(competition.joinCode).toUpperCase()) {
        throw new BadRequestException('Invalid join code. Please check the code with your organizer and try again.');
      }
    }

    // Capacity re-check at team level too (double-checked membership below)
    const existingTeams = await this.teamRepository.findByCompetition(competitionId);
    const registeredCount = existingTeams.filter((t) => t.status !== 'rejected' && t.status !== 'banned').length;
    if (competition.maxTeams > 0 && registeredCount >= competition.maxTeams) {
      throw new BadRequestException('Team capacity is full for this competition.');
    }

    // Validate member usernames actually exist (roster addition path, §5.1)
    const memberList = Array.isArray(members) ? members : [];
    if (memberList.length) {
      const allUsers = await this.userRepository.findAll();
      const existing = new Set(allUsers.map((u) => String(u.username || '').toLowerCase()));
      const unknown = memberList.map((m) => String(m || '').trim().replace(/^@/, ''))
        .filter((m) => m && !existing.has(m.toLowerCase()));
      if (unknown.length) {
        throw new BadRequestException(`Unknown member username(s): ${unknown.join(', ')}. This username does not exist.`);
      }
    }

    if (name && name.trim().length < 3) {
      throw new BadRequestException('Team name must be at least 3 characters.');
    }

    // §4.1 — automatic approval: teams are eligible immediately after creation
    const team = await this.teamRepository.create(name.trim(), competitionId, leaderId, memberList, 'approved');

    await this.auditLog.record('TEAM_CREATED', {
      actor: leaderId,
      entityType: 'team',
      entityId: (team as any).id,
      details: `Team "${team.name}" created for competition ${competitionId} (auto-approved).`,
    });

    // §14 — notify organizer(s) that a team joined the competition
    (competition.organizers || [competition.createdBy]).filter(Boolean).forEach((org) => {
      this.notificationsService.create({
        toUsername: String(org),
        type: 'team-created',
        status: 'approved',
        title: '🛡️ Team Registered',
        body: `Team "${team.name}" (@${leaderId}) registered for "${competition.name}" and is now eligible (no approval required).`,
        meta: { compId: competitionId, teamId: (team as any).id },
      }).catch(() => {});
    });

    return team;
  }

  async getTeamById(id: string): Promise<ITeam> {
    const team = await this.teamRepository.findById(id);
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    return team;
  }

  async getAllTeams(): Promise<ITeam[]> {
    return this.teamRepository.findAll();
  }

  async getTeamsByCompetition(competitionId: string): Promise<ITeam[]> {
    return this.teamRepository.findByCompetition(competitionId);
  }

  async getTeamsByLeader(leaderId: string): Promise<ITeam[]> {
    return this.teamRepository.findByLeader(leaderId);
  }

  async updateTeam(id: string, updateTeamDto: UpdateTeamDto, user: any): Promise<ITeam> {
    const team = await this.verifyTeamOwnership(id, user);
    const competition = await this.competitionRepository.findById(team.competitionId);

    // §6.2 — roster/membership frozen once the competition has started
    if (updateTeamDto.members && competition && isCompetitionStarted(competition as any)) {
      throw new ForbiddenException('The competition has started: team membership can no longer be changed. Use the dispute/report workflow instead.');
    }
    if (updateTeamDto.members) {
      await this.assertCapacity(team.competitionId, team, updateTeamDto.members.length);
    }

    const updates: Partial<ITeam> = {};
    if (updateTeamDto.name) updates.name = updateTeamDto.name;
    if (updateTeamDto.members) updates.members = updateTeamDto.members;

    return this.teamRepository.update(id, updates);
  }

  /** §5.1 — capacity must be verified against competition.maxPlayersPerTeam on EVERY roster-changing path. */
  private async assertCapacity(competitionId: string, team: ITeam, desiredRosterSize: number) {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) throw new NotFoundException(`Competition with ID ${competitionId} not found`);
    const max = competition.maxPlayersPerTeam > 0 ? competition.maxPlayersPerTeam : 0;
    if (max > 0 && desiredRosterSize > max) {
      throw new BadRequestException(`Team is full — maximum ${max} player(s) per team.`);
    }
  }

  async addMember(teamId: string, addTeamMemberDto: AddTeamMemberDto, user: any): Promise<ITeam> {
    const team = await this.verifyTeamOwnership(teamId, user);
    const competition = await this.competitionRepository.findById(team.competitionId);

    // §6.2 — additions blocked after competition start
    if (competition && isCompetitionStarted(competition as any)) {
      throw new ForbiddenException('The competition has started: new players can no longer be added.');
    }

    const member = String(addTeamMemberDto.memberId || '').trim().replace(/^@/, '');
    if (!member) throw new BadRequestException('Member username is required.');

    // the username must belong to a registered account
    const memberUser = await this.userRepository.findByUsername(member);
    if (!memberUser) throw new BadRequestException(`@${member} does not exist. This username does not exist.`);

    const rosterSize = ((team as any).memberUsernames || []).length;
    await this.assertCapacity(team.competitionId, team, rosterSize + 1);

    const updated = await this.teamRepository.addMember(teamId, member);

    await this.auditLog.record('TEAM_MEMBER_ADDED', {
      actor: user?.username || 'system',
      entityType: 'team',
      entityId: teamId,
      details: `@${member} added to team "${team.name}".`,
      metadata: { rosterSize: rosterSize + 1, max: competition?.maxPlayersPerTeam },
    });

    this.notificationsService.create({
      toUsername: member,
      type: 'team-member-added',
      status: 'approved',
      title: '🛡️ Added to Team',
      body: `You were added to team "${team.name}" in "${competition?.name || 'a competition'}".`,
      meta: { compId: team.competitionId, teamId },
    }).catch(() => {});

    return updated;
  }

  /**
   * §6.1 — team leads may remove a member only with a mandatory reason and only
   * when that participant has NOT paid any participation fee (checked against
   * authoritative persisted payment records, never frontend-supplied status).
   * §6.2 — removal is blocked entirely once the competition has started.
   */
  async removeMember(teamId: string, memberId: string, reason: string, user: any): Promise<ITeam> {
    const team = await this.verifyTeamOwnership(teamId, user);
    const competition = await this.competitionRepository.findById(team.competitionId);

    if (competition && isCompetitionStarted(competition as any)) {
      throw new ForbiddenException('The competition has started: players can no longer be removed. Use the dispute/report workflow instead.');
    }

    const meaningfulReason = String(reason || '').trim();
    if (meaningfulReason.length < 5) {
      throw new BadRequestException('A meaningful removal reason (at least 5 characters) is required.');
    }

    const member = String(memberId || '').trim().replace(/^@/, '');
    if (member.toLowerCase() === String(team.leaderId || '').toLowerCase()) {
      throw new BadRequestException('Cannot remove the team leader. Disband the team instead.');
    }

    // Authoritative payment check — frontend-supplied payment status is never trusted
    const hasPaid = await this.participantHasPaid(team.competitionId, member);
    if (hasPaid) {
      throw new ForbiddenException(
        '@' + member + ' has paid the participation fee and cannot be removed directly. Use the dispute/report workflow so an organizer can review the case.',
      );
    }

    const updated = await this.teamRepository.removeMember(teamId, member);

    await this.auditLog.record('TEAM_MEMBER_REMOVED', {
      actor: user?.username || 'system',
      entityType: 'team',
      entityId: teamId,
      details: `@${member} removed from team "${team.name}". Reason: ${meaningfulReason}`,
      metadata: { reason: meaningfulReason },
    });

    this.notificationsService.create({
      toUsername: member,
      type: 'team-member-removed',
      title: '🚪 Removed from Team',
      body: `You were removed from team "${team.name}" ${competition ? `in "${competition.name}"` : ''}. Reason: ${meaningfulReason}`,
      meta: { compId: team.competitionId, teamId },
    }).catch(() => {});

    return updated;
  }

  async deleteTeam(id: string, user?: any): Promise<void> {
    await this.teamRepository.delete(id);
    await this.auditLog.record('TEAM_DELETED', {
      actor: user?.username || 'system',
      entityType: 'team',
      entityId: id,
      details: 'Team deleted by administrator.',
    });
  }

  /**
   * §4.2 — disband workflow: reason required, blocked after competition start,
   * notifies organizer + members, and records traceable (pending) refund
   * requests for eligible paid participants. Refund processing is idempotent.
   */
  async disbandTeam(teamId: string, reason: string, user: any): Promise<{ team: ITeam; refunds: { username: string; amount: number | null; status: string }[] }> {
    const team = await this.verifyTeamOwnership(teamId, user);
    const competition = await this.competitionRepository.findById(team.competitionId);

    // Prevent disbanding once the competition has started (§4.2)
    if (competition && isCompetitionStarted(competition as any)) {
      throw new ForbiddenException('Disbanding is not allowed after the competition has started.');
    }

    const meaningfulReason = String(reason || '').trim();
    if (meaningfulReason.length < 10) {
      throw new BadRequestException('A meaningful disband reason (at least 10 characters) is required.');
    }

    const members = [...(team.memberUsernames || [])].filter(
      (m) => m && String(m).toLowerCase() !== String(team.leaderId || '').toLowerCase(),
    );

    const teamStatus = await this.teamRepository.setStatus(teamId, 'disbanded', user?.username || 'team-lead');

    await this.auditLog.record('TEAM_DISBAND', {
      actor: user?.username || 'system',
      entityType: 'team',
      entityId: teamId,
      details: `Team "${team.name}" disbanded${competition ? ` from "${competition.name}"` : ''}. Reason: ${meaningfulReason}`,
      metadata: { reason: meaningfulReason, memberCount: members.length },
    });

    // Notify the organizer
    (competition?.organizers || [competition?.createdBy]).filter(Boolean).forEach((org) => {
      this.notificationsService.create({
        toUsername: String(org),
        type: 'team-disbanded',
        title: '⚠️ Team Disbanded',
        body: `Team "${team.name}" disbanded${competition ? ` from "${competition.name}"` : ''}. Reason: ${meaningfulReason}`,
        meta: { compId: competition?.id, teamId, reason: meaningfulReason },
      }).catch(() => {});
    });

    // Notify affected participants
    members.forEach((m) => {
      this.notificationsService.create({
        toUsername: m,
        type: 'team-disbanded',
        title: '⚠️ Your Team Disbanded',
        body: `Team "${team.name}" ${competition ? `in "${competition.name}"` : ''} has been disbanded by the team lead. Refunds, if any were collected, are being initiated and may take a few days depending on payment processing. Reason: ${meaningfulReason}`,
        meta: { compId: competition?.id, teamId },
      }).catch(() => {});
    });

    // Refund requests for eligible paid participants — traceable + idempotent.
    // NOTE: participant entry-fee payment records do not exist on this platform
    // yet (entry fees are not collected at source today), so automatic refunds
    // cannot be initiated; requests are recorded as PENDING for the support
    // workflow to process manually. No refund is ever marked as completed here.
    const refunds: { username: string; amount: number | null; status: string }[] = [];
    for (const member of members) {
      const hasPaid = await this.participantHasPaid(team.competitionId, member);
      if (!hasPaid) continue;
      const refundKey = `disband:${teamId}:${member}`;
      const existing = await this.refundRepo.findOne({ where: { refundKey } });
      if (existing) {
        refunds.push({ username: member, amount: existing.amount ?? null, status: existing.status });
        continue; // idempotent — never duplicate refunds
      }
      const request = this.refundRepo.create({
        refundKey,
        competitionId: team.competitionId,
        competitionName: competition?.name || '',
        teamId,
        teamName: team.name,
        username: member,
        amount: competition?.entryFeeAmount ?? null,
        reason: `Team "${team.name}" disbanded: ${meaningfulReason}`,
        status: 'pending',
        requestedBy: user?.username || 'system',
      });
      await this.refundRepo.save(request);
      refunds.push({ username: member, amount: request.amount ?? null, status: 'pending' });

      await this.auditLog.record('REFUND_REQUESTED', {
        actor: user?.username || 'system',
        entityType: 'refund_request',
        entityId: (request as any).id,
        details: `Pending refund requested for @${member} (disband of "${team.name}").`,
        metadata: { refundKey, amount: request.amount ?? null },
      });
    }

    return { team: teamStatus, refunds };
  }

  /** Support/admin workflow: list pending refund requests (§4.2). */
  async getRefundRequests(status?: string) {
    if (status) {
      return this.refundRepo.find({ where: { status }, order: { createdAt: 'DESC' } });
    }
    return this.refundRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** Support/admin workflow: resolve a refund request. Explicitly NOT pretending a real payment completed. */
  async resolveRefundRequest(refundId: string, newStatus: 'completed' | 'failed' | 'cancelled', resolvedBy: string, note?: string) {
    const refund = await this.refundRepo.findOne({ where: { id: refundId } });
    if (!refund) throw new NotFoundException(`Refund request ${refundId} not found`);
    const updated = await this.refundRepo.update(refundId, {
      status: newStatus,
      resolvedBy,
      statusNote: note || '',
    });

    await this.auditLog.record('REFUND_STATUS_CHANGED', {
      actor: resolvedBy,
      entityType: 'refund_request',
      entityId: refundId,
      details: `Refund for @${refund.username} (key=${refund.refundKey}) set to ${newStatus}.`,
      metadata: { note: note || '' },
    });

    this.notificationsService.create({
      toUsername: refund.username,
      type: 'refund-status',
      status: newStatus,
      title: `💸 Refund ${newStatus}`,
      body: `Your refund request for "${refund.competitionName || 'a competition'}" is now "${newStatus}". ${note || 'Processing may take a few days.'}`,
      meta: { compId: refund.competitionId, refundId },
    }).catch(() => {});

    return updated;
  }

  async addWarning(teamId: string, issuedBy: string) {
    return this.teamRepository.addWarning(teamId, issuedBy);
  }

  async banTeam(teamId: string, issuedBy: string) {
    return this.teamRepository.banTeam(teamId, issuedBy);
  }

  async setStatus(teamId: string, status: string, issuedBy: string) {
    return this.teamRepository.setStatus(teamId, status, issuedBy);
  }

  async createJoinRequest(teamId: string, competitionId: string, user: any, message?: string, joinCode?: string) {
    // backend-derived username; the frontend value is never trusted
    const fromUsername = String(user?.username || '').trim();
    if (!fromUsername) throw new ForbiddenException('User context required');
    await this.assertVerified(user, 'request to join a team');

    const team = await this.teamRepository.findById(teamId);
    if (!team) throw new NotFoundException(`Team with ID ${teamId} not found`);
    if (team.status === 'disbanded') {
      throw new BadRequestException('This team has been disbanded and is no longer accepting requests.');
    }

    const competition = await this.competitionRepository.findById(competitionId || team.competitionId);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${competitionId || team.competitionId} not found`);
    }
    if (competition.visibility === 'private') {
      const code = String(joinCode || '').trim().toUpperCase();
      if (!competition.joinCode || code !== String(competition.joinCode).toUpperCase()) {
        throw new BadRequestException('Invalid join code. Please check the code with your organizer and try again.');
      }
    }
    if (isCompetitionStarted(competition as any)) {
      throw new ForbiddenException('The competition has started: join requests are closed.');
    }

    // §5.1 — concurrent requests cannot exceed the limit: check before creating
    const rosterSize = (team.memberUsernames || []).length;
    await this.assertCapacity(team.competitionId, team as any, rosterSize + 1);

    return this.teamRepository.createJoinRequest(teamId, team.competitionId, fromUsername, message);
  }

  async getJoinRequestsByTeam(teamId: string) {
    return this.teamRepository.getJoinRequestsByTeam(teamId);
  }

  async updateJoinRequest(id: string, status: string, user: any) {
    const req = await this.teamRepository.findJoinRequestById(id);
    if (!req) {
      throw new NotFoundException(`Join request with ID ${id} not found`);
    }
    await this.verifyTeamOwnership(req.teamId, user);
    const reviewer = user?.username || user?.id || 'captain';
    const updated = await this.teamRepository.updateJoinRequest(id, status, reviewer);

    // §5.1 — approval must respect capacity even under concurrent approvals
    if (String(status).toLowerCase() === 'approved') {
      const team = await this.teamRepository.findById(req.teamId);
      const rosterSize = (team.memberUsernames || []).length;
      await this.assertCapacity(team.competitionId, team, rosterSize + 1);
      if (req.fromUsername && !(team.memberUsernames || []).includes(req.fromUsername)) {
        await this.teamRepository.addMember(req.teamId, req.fromUsername);
        const after = await this.teamRepository.findById(req.teamId);
        await this.auditLog.record('JOIN_REQUEST_APPROVED', {
          actor: reviewer,
          entityType: 'team',
          entityId: req.teamId,
          details: `@${req.fromUsername} added via join-request approval. Roster: ${(after.memberUsernames || []).length}.`,
        });
        this.notificationsService.create({
          toUsername: req.fromUsername,
          type: 'join-request-approved',
          status: 'approved',
          title: '✅ Join Request Approved',
          body: `Your request to join "${team.name}" was approved.`,
          meta: { compId: team.competitionId, teamId: team.id },
        }).catch(() => {});
      }
    } else {
      this.notificationsService.create({
        toUsername: (req as any).fromUsername,
        type: 'join-request-updated',
        status: String(status),
        title: `Join Request ${status}`,
        body: `Your request to join a team was ${status}.`,
        meta: {},
      }).catch(() => {});
    }
    return updated;
  }

  async createInvite(teamId: string, competitionId: string, toUsername: string, fromUsername: string, user: any) {
    await this.assertVerified(user, 'invite a player to a team');
    const team = await this.teamRepository.findById(teamId);
    if (!team) throw new NotFoundException(`Team with ID ${teamId} not found`);

    const competition = await this.competitionRepository.findById(competitionId || team.competitionId);
    if (competition && isCompetitionStarted(competition as any)) {
      throw new ForbiddenException('The competition has started: players can no longer be invited.');
    }

    const rosterSize = (team.memberUsernames || []).length;
    await this.assertCapacity(team.competitionId, team, rosterSize + 1);

    const invite = await this.teamRepository.createInvite(teamId, team.competitionId, toUsername, fromUsername);
    this.notificationsService.create({
      toUsername: toUsername,
      type: 'team-invite',
      title: '📨 Team Invitation',
      body: `@${fromUsername} invited you to join team "${team.name}"${competition ? ` in "${competition.name}"` : ''}.`,
      meta: { compId: team.competitionId, teamId },
    }).catch(() => {});
    return invite;
  }

  async getInvitesByUser(toUsername: string) {
    return this.teamRepository.getInvitesByUser(toUsername);
  }

  async updateInvite(id: string, status: string, user?: any) {
    const invite = await this.teamRepository.findInviteById(id);
    if (!invite) throw new NotFoundException(`Invite with ID ${id} not found`);

    if (String(status).toLowerCase() === 'accepted') {
      await this.assertVerified(user, 'accept a team invitation');
      const team = await this.teamRepository.findById(invite.teamId);
      if (!team) throw new NotFoundException(`Team with ID ${invite.teamId} not found`);
      if (team.status === 'disbanded') {
        throw new BadRequestException('This team has been disbanded; the invitation is no longer valid.');
      }
      const competition = await this.competitionRepository.findById(team.competitionId);
      if (competition && isCompetitionStarted(competition as any)) {
        throw new ForbiddenException('The competition has started: rosters are locked.');
      }
      const rosterSize = (team.memberUsernames || []).length;
      await this.assertCapacity(team.competitionId, team, rosterSize + 1);
      if (!(team.memberUsernames || []).includes(invite.toUsername)) {
        await this.teamRepository.addMember(invite.teamId, invite.toUsername);
        await this.auditLog.record('TEAM_INVITE_ACCEPTED', {
          actor: invite.toUsername,
          entityType: 'team',
          entityId: invite.teamId,
          details: `@${invite.toUsername} joined "${team.name}" by accepting an invite. Roster: ${rosterSize + 1}.`,
        });
      }
    }

    return this.teamRepository.updateInvite(id, status);
  }
}
