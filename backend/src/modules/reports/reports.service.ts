import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ReportEntity } from '../../entities/report.entity';
import { ReportEvidenceEntity } from '../../entities/report-evidence.entity';
import { ReportDiscussionEntity } from '../../entities/report-discussion.entity';
import { ReportDiscussionParticipantEntity } from '../../entities/report-discussion-participant.entity';
import { ReportDiscussionMessageEntity } from '../../entities/report-discussion-message.entity';
import { ReportStatusHistoryEntity } from '../../entities/report-status-history.entity';
import { ReportAuditLogEntity } from '../../entities/report-audit-log.entity';
import { ReportingRestrictionEntity } from '../../entities/reporting-restriction.entity';
import { CompetitionRemovalEntity } from '../../entities/competition-removal.entity';
import { UserEntity } from '../../entities/user.entity';
import { UserRole } from '../../common/interfaces';
import { TeamEntity } from '../../entities/team.entity';
import { MatchEntity } from '../../entities/match.entity';
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import { ReputationService } from '../reputation/reputation.service';
import {
  DISCARD_REASONS,
  MAX_DISCARDED_REPORTS,
  MODERATOR_ACTIONS,
  ORGANISER_ACTIONS,
  REPORT_FINDINGS,
  REPORT_PRIORITIES,
  REPORT_REASONS,
  ReportAction,
  ReportPriority,
  ReportQueue,
  ReportStatus,
} from '../../common/reporting';
import {
  AddParticipantDto,
  CreateReportDto,
  DiscardReportDto,
  DiscussionMessageDto,
  ModeratorDecisionDto,
  PlayerDecisionDto,
  PriorityDto,
} from './dto/report.dto';

const REVIEW_STATUSES: ReportStatus[] = ['new', 'under_review', 'awaiting_response'];
const MAX_EVIDENCE = 5;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ReportsService implements OnModuleInit {
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ReportEntity) private readonly reports: Repository<ReportEntity>,
    @InjectRepository(ReportEvidenceEntity) private readonly evidence: Repository<ReportEvidenceEntity>,
    @InjectRepository(ReportDiscussionEntity) private readonly discussions: Repository<ReportDiscussionEntity>,
    @InjectRepository(ReportDiscussionParticipantEntity)
    private readonly participants: Repository<ReportDiscussionParticipantEntity>,
    @InjectRepository(ReportDiscussionMessageEntity)
    private readonly messages: Repository<ReportDiscussionMessageEntity>,
    @InjectRepository(ReportStatusHistoryEntity) private readonly statusHistory: Repository<ReportStatusHistoryEntity>,
    @InjectRepository(ReportAuditLogEntity) private readonly reportAudit: Repository<ReportAuditLogEntity>,
    @InjectRepository(ReportingRestrictionEntity) private readonly restrictions: Repository<ReportingRestrictionEntity>,
    @InjectRepository(TeamEntity) private readonly teams: Repository<TeamEntity>,
    @InjectRepository(MatchEntity) private readonly matches: Repository<MatchEntity>,
    @InjectRepository(ChatMessageEntity) private readonly chat: Repository<ChatMessageEntity>,
    @InjectRepository(AuditLogEntity) private readonly auditRows: Repository<AuditLogEntity>,
    private readonly dataSource: DataSource,
    private readonly competitions: CompetitionRepository,
    private readonly users: UserRepository,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
    private readonly reputation: ReputationService,
  ) {}

  onModuleInit(): void {
    // Persistent server-side reminder sweep (never a browser timer). The same
    // sweep is exposed as an endpoint so an external scheduler can call it.
    this.sweepTimer = setInterval(() => {
      this.escalateOverdue().catch(() => undefined);
    }, 10 * 60 * 1000);
    if (typeof this.sweepTimer.unref === 'function') this.sweepTimer.unref();
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  private reportCode(id: string): string {
    return `RPT-${String(id).slice(0, 8).toUpperCase()}`;
  }

  private async organizersOf(competitionId: string): Promise<string[]> {
    const comp: any = await this.competitions.findById(competitionId);
    if (!comp) throw new NotFoundException(`Competition ${competitionId} not found`);
    const list = [comp.createdBy, ...(Array.isArray(comp.organizers) ? comp.organizers : [])].filter(Boolean);
    return Array.from(new Set(list.map((name: string) => String(name))));
  }

  private validateEvidence(list: any[] | undefined) {
    if (!list || !list.length) return [];
    if (!Array.isArray(list)) throw new BadRequestException('Evidence must be a list of files.');
    if (list.length > MAX_EVIDENCE) throw new BadRequestException(`Attach at most ${MAX_EVIDENCE} evidence files.`);
    return list.map((item) => {
      const url = String(item?.url || '');
      const isDataImage = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
      const isUploaded = /^\/upload\/file\/[A-Za-z0-9._-]+$/.test(url);
      if (!isDataImage && !isUploaded) {
        throw new BadRequestException('Evidence must be a PNG/JPEG/WEBP image or an uploaded file reference.');
      }
      const size = Number(item?.size || Math.round(url.length * 0.75));
      if (size > MAX_EVIDENCE_BYTES) throw new BadRequestException('Each evidence file must be 5 MB or smaller.');
      return {
        url,
        filename: String(item?.filename || 'evidence').slice(0, 200),
        mimetype: String(item?.mimetype || (isDataImage ? url.slice(5, url.indexOf(';')) : 'application/octet-stream')).slice(0, 100),
        sizeBytes: size,
      };
    });
  }

  private async recordStatus(
    report: ReportEntity,
    toStatus: ReportStatus,
    actor: string,
    note: string | null,
    manager?: any,
  ) {
    const repo = manager ? manager.getRepository(ReportStatusHistoryEntity) : this.statusHistory;
    await repo.save(
      repo.create({ reportId: report.id, fromStatus: report.status, toStatus, actor, note: note || null }),
    );
  }

  private async audit(reportId: string, action: string, actor: string, details: string, metadata: Record<string, any> = {}) {
    try {
      await this.reportAudit.save(
        this.reportAudit.create({ reportId, action, actor, details, metadata }),
      );
    } catch (err) {
      // Reporting must not fail because the audit table is unavailable.
    }
  }

  private async notifyReviewers(report: ReportEntity, competitionId: string, title: string, body: string) {
    const targets = new Set<string>();
    if (report.queue === 'organiser') {
      const organizers = await this.organizersOf(competitionId).catch(() => []);
      organizers.forEach((name) => targets.add(name));
      if (report.assignedTo) targets.add(report.assignedTo);
    } else {
      const staff = await this.users.findAll();
      staff
        .filter((u: any) => ['community_moderator', 'super_admin'].includes(String(u.role || '').toLowerCase()))
        .forEach((u: any) => targets.add(u.username));
    }
    targets.delete(report.reporterUsername);
    await Promise.all(
      Array.from(targets).map((toUsername) =>
        this.notifications
          .create({
            toUsername,
            type: 'report-filed',
            status: 'pending',
            title,
            body,
            meta: { reportId: report.id, compId: competitionId, priority: report.priority },
          })
          .catch(() => undefined),
      ),
    );
  }

  private async notifyUser(username: string, title: string, body: string, meta: Record<string, any> = {}) {
    await this.notifications
      .create({ toUsername: username, type: 'report-update', title, body, meta })
      .catch(() => undefined);
  }

  private isModerator(user: any): boolean {
    return ['community_moderator', 'super_admin'].includes(String(user?.role || '').toLowerCase());
  }

  private async assertCanReview(report: ReportEntity, user: any) {
    const username = String(user?.username || '');
    if (report.queue === 'moderator') {
      if (!this.isModerator(user)) {
        throw new ForbiddenException('Only a Community Moderator can review reports against organisers.');
      }
      return;
    }
    const organizers = await this.organizersOf(report.competitionId);
    const isOrganizer = organizers.some((name) => name.toLowerCase() === username.toLowerCase());
    if (!isOrganizer && String(user?.role) !== 'super_admin') {
      throw new ForbiddenException('Only an organiser of this competition can review this report.');
    }
    // An organiser must never investigate a report against themselves.
    if (report.reportedUsername.toLowerCase() === username.toLowerCase()) {
      throw new ForbiddenException('You cannot review a report filed against you.');
    }
  }

  private async assertParticipant(report: ReportEntity, user: any): Promise<boolean> {
    const username = String(user?.username || '').toLowerCase();
    if (report.reporterUsername.toLowerCase() === username || report.reportedUsername.toLowerCase() === username) return true;
    const row = await this.participants
      .createQueryBuilder('p')
      .innerJoin(ReportDiscussionEntity, 'd', 'd.id = p."discussionId"')
      .where('d."reportId" = :reportId', { reportId: report.id })
      .andWhere('lower(p.username) = :username', { username })
      .getOne();
    return !!row;
  }

  // ─── Submission ────────────────────────────────────────────────────────────
  async create(dto: CreateReportDto, user: any) {
    const reporter = String(user?.username || '').trim();
    if (!reporter) throw new ForbiddenException('Authentication is required to file a report.');

    const competitionId = String(dto.competitionId || '').trim();
    const reportedUsername = String(dto.reportedUsername || '').trim().replace(/^@/, '');
    if (!competitionId) throw new BadRequestException('A competition is required.');
    if (!reportedUsername) throw new BadRequestException('Who is the report against?');

    const comp = await this.competitions.findById(competitionId);
    if (!comp) throw new NotFoundException('Competition not found.');
    const organizers = await this.organizersOf(competitionId);
    if (organizers.some((name) => name.toLowerCase() === reporter.toLowerCase())) {
      // Organisers may still report, but never against themselves (checked below).
    }
    if (reportedUsername.toLowerCase() === reporter.toLowerCase()) {
      throw new BadRequestException('You cannot file a report against yourself.');
    }

    const reportedUser = await this.users.findByUsername(reportedUsername);
    if (!reportedUser) throw new BadRequestException('The reported user does not exist.');

    // An organiser complaint is independent of the original report: the original
    // decision is captured here and is never altered or reversed by filing it.
    let originalReport: ReportEntity | null = null;
    if (dto.originalReportId) {
      originalReport = await this.reports.findOne({ where: { id: String(dto.originalReportId) } });
      if (!originalReport) throw new BadRequestException('The original report could not be found.');
      if (String(originalReport.competitionId) !== competitionId) {
        throw new BadRequestException('The original report belongs to another competition.');
      }
      if (originalReport.reportedUsername.toLowerCase() !== reporter.toLowerCase()) {
        throw new ForbiddenException('Only the player affected by the original decision can file this complaint.');
      }
      if (originalReport.status !== 'resolved' || !originalReport.resolvedBy) {
        throw new BadRequestException('The original report has no organiser decision to complain about.');
      }
      if (originalReport.resolvedBy.toLowerCase() !== reportedUsername.toLowerCase()) {
        throw new BadRequestException('The complaint must name the organiser who recorded the decision.');
      }
      if (!['warning', 'remove_from_competition'].includes(String(originalReport.action))) {
        throw new BadRequestException('Only a punitive decision can be reported.');
      }
    }

    const reason = REPORT_REASONS[dto.reasonCode];
    if (!reason) throw new BadRequestException('Choose a valid report reason.');

    const teams = await this.teams.find({ where: { competitionId } });
    const reportedTeam =
      teams.find((t) => String(t.leaderId || '').toLowerCase() === reportedUsername.toLowerCase()) ||
      teams.find((t) => (t.memberUsernames || []).some((m) => String(m).toLowerCase() === reportedUsername.toLowerCase())) ||
      null;
    const reporterTeam =
      teams.find((t) => (t.memberUsernames || []).some((m) => String(m).toLowerCase() === reporter.toLowerCase())) ||
      null;

    const isOrganizerTarget = organizers.some((name) => name.toLowerCase() === reportedUsername.toLowerCase());
    if (!isOrganizerTarget && !reportedTeam) {
      throw new BadRequestException('The reported person is not part of this competition.');
    }
    if (!isOrganizerTarget && !reporterTeam && !organizers.some((name) => name.toLowerCase() === reporter.toLowerCase())) {
      throw new ForbiddenException('Only registered participants of this competition can file this report.');
    }
    if (isOrganizerTarget && reason.against === 'participant') {
      throw new BadRequestException('This reason applies to participants; choose an organiser-related reason.');
    }
    if (!isOrganizerTarget && reason.against === 'organiser') {
      throw new BadRequestException('This reason applies to organisers only.');
    }

    const description = String(dto.description || '').trim();
    if (description.length < 15) throw new BadRequestException('Describe what happened (at least 15 characters).');
    if (description.length > 4000) throw new BadRequestException('Description is too long (max 4000 characters).');
    const evidenceRows = this.validateEvidence(dto.evidence);

    const reportedRole = isOrganizerTarget
      ? 'organiser'
      : reportedTeam && String(reportedTeam.leaderId || '').toLowerCase() === reportedUsername.toLowerCase()
        ? 'team_leader'
        : 'player';
    const firstLevel = isOrganizerTarget ? 'moderator' : reporterTeam && reportedTeam && reporterTeam.id === reportedTeam.id ? 'team_leader' : 'organiser';
    const queue: ReportQueue = isOrganizerTarget ? 'moderator' : 'organiser';

    const related = await this.reports.findOne({
      where: { competitionId, reportedUsername, reasonCode: dto.reasonCode },
      order: { createdAt: 'DESC' },
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const restrictionRepo = manager.getRepository(ReportingRestrictionEntity);
      let restriction = await restrictionRepo.findOne({
        where: { competitionId, username: reporter },
        lock: { mode: 'pessimistic_write' },
      });
      if (!restriction) {
        try {
          restriction = await restrictionRepo.save(restrictionRepo.create({ competitionId, username: reporter, discardedCount: 0 }));
        } catch (err) {
          restriction = await restrictionRepo.findOne({
            where: { competitionId, username: reporter },
            lock: { mode: 'pessimistic_write' },
          });
        }
      }
      const discarded = await manager.getRepository(ReportEntity).count({
        where: { competitionId, reporterUsername: reporter, status: 'discarded' },
      });
      if (discarded >= MAX_DISCARDED_REPORTS || Number(restriction?.discardedCount || 0) >= MAX_DISCARDED_REPORTS) {
        throw new ForbiddenException(
          `You have reached the limit of ${MAX_DISCARDED_REPORTS} baseless reports in this competition and can no longer report anyone here.`,
        );
      }

      const reportRepo = manager.getRepository(ReportEntity);
      const report = reportRepo.create({
        competitionId,
        matchId: dto.matchId ? String(dto.matchId) : null,
        reporterUsername: reporter,
        reporterRole: String(user?.role || 'participant'),
        reporterTeamId: reporterTeam?.id || null,
        reportedUsername: reportedUser.username,
        reportedRole,
        reportedTeamId: reportedTeam?.id || null,
        firstLevel,
        reasonCode: dto.reasonCode,
        category: reason.category,
        priority: reason.priority,
        description,
        incidentAt: dto.incidentAt && !Number.isNaN(new Date(dto.incidentAt).getTime()) ? new Date(dto.incidentAt) : null,
        sourcePage: dto.sourcePage ? String(dto.sourcePage).slice(0, 200) : null,
        status: 'new',
        queue,
        assignedTo: queue === 'organiser' ? comp.createdBy : null,
        relatedReportId: originalReport?.id || (related && related.status !== 'discarded' ? related.id : null),
        originalReportId: originalReport?.id || null,
        originalDecision: originalReport
          ? `${originalReport.finding} · ${originalReport.action}: ${originalReport.conclusion || ''}`.trim()
          : null,
      } as Partial<ReportEntity>);
      const stored = await reportRepo.save(report);

      if (evidenceRows.length) {
        const evidenceRepo = manager.getRepository(ReportEvidenceEntity);
        await evidenceRepo.save(
          evidenceRows.map((row) =>
            evidenceRepo.create({ ...row, reportId: stored.id, uploadedBy: reporter }),
          ),
        );
      }
      await manager.getRepository(ReportStatusHistoryEntity).save(
        manager.getRepository(ReportStatusHistoryEntity).create({
          reportId: stored.id,
          fromStatus: null,
          toStatus: 'new',
          actor: reporter,
          note: `Routed to ${queue === 'moderator' ? 'Community Moderator' : 'competition organiser'} (${reportedRole}).`,
        }),
      );
      return stored;
    });

    await this.audit(saved.id, 'REPORT_SUBMITTED', reporter, `Report against @${reportedUser.username} (${dto.reasonCode}).`, {
      competitionId,
      queue,
      priority: reason.priority,
      relatedReportId: saved.relatedReportId,
    });
    await this.notifyReviewers(
      saved,
      competitionId,
      queue === 'moderator' ? '🚩 New report against an organiser' : '⚠ New participant report',
      `@${reporter} reported @${reportedUser.username} in "${comp.name}". Priority: ${reason.priority}.`,
    );
    await this.notifyUser(
      reporter,
      'Report submitted',
      `Your report (${this.reportCode(saved.id)}) was submitted and routed to ${queue === 'moderator' ? 'the Community Moderator' : 'the organiser'}. A report is an allegation — no punishment is applied automatically.`,
      { reportId: saved.id, compId: competitionId },
    );

    return this.decorate(saved);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────
  private async decorate(report: ReportEntity) {
    const [comp, reporterPrior, accusedPrior] = await Promise.all([
      this.competitions.findById(report.competitionId).catch(() => null),
      this.reports.count({
        where: {
          reporterUsername: report.reporterUsername,
          status: 'resolved',
          finding: In(['substantiated', 'partially_substantiated']),
        },
      }),
      this.reports.count({
        where: {
          reportedUsername: report.reportedUsername,
          status: 'resolved',
          finding: In(['substantiated', 'partially_substantiated']),
        },
      }),
    ]);
    const original = report.originalReportId
      ? await this.reports.findOne({ where: { id: report.originalReportId } }).catch(() => null)
      : null;
    return {
      ...report,
      code: this.reportCode(report.id),
      competitionName: comp?.name || report.competitionId,
      reporterPriorSubstantiated: reporterPrior,
      accusedPriorSubstantiated: accusedPrior,
      // Shown to the Community Moderator alongside the complaint.
      originalReport: original
        ? {
          id: original.id,
          code: this.reportCode(original.id),
          description: original.description,
          finding: original.finding,
          action: original.action,
          conclusion: original.conclusion,
          resolvedBy: original.resolvedBy,
          resolvedAt: original.resolvedAt,
          status: original.status,
        }
        : null,
    };
  }

  async listForOrganiser(username: string, status?: string) {
    const comps = await this.competitions.findByOrganizer(username);
    const ids = comps.map((c: any) => c.id);
    if (!ids.length) return [];
    const where: Record<string, any> = { queue: 'organiser', competitionId: In(ids) };
    if (status && status !== 'all') where.status = status;
    const rows = await this.reports.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    return Promise.all(rows.map((row) => this.decorate(row)));
  }

  async listForModeration(status?: string) {
    const where: Record<string, any> = { queue: 'moderator' };
    if (status && status !== 'all') where.status = status;
    const rows = await this.reports.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    return Promise.all(rows.map((row) => this.decorate(row)));
  }

  async listMine(username: string) {
    // Reports the user filed, reports filed against them, and reports whose case
    // discussion they are an authorised participant of — one record per report.
    const participantRows = await this.participants.find({ where: { username } });
    const discussionIds = Array.from(new Set(participantRows.map((row) => row.discussionId)));
    const participantReportIds = discussionIds.length
      ? Array.from(new Set((await this.discussions.find({ where: { id: In(discussionIds) } })).map((row) => row.reportId)))
      : [];
    const where: Record<string, any>[] = [
      { reporterUsername: username },
      { reportedUsername: username },
    ];
    if (participantReportIds.length) where.push({ id: In(participantReportIds) });
    const rows = await this.reports.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    return Promise.all(rows.map((row) => this.decorate(row)));
  }

  async get(id: string, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    const username = String(user?.username || '');
    let reviewer = false;
    try {
      await this.assertCanReview(report, user);
      reviewer = true;
    } catch (err) {
      reviewer = false;
    }
    const participant = await this.assertParticipant(report, user);
    if (!reviewer && !participant) throw new ForbiddenException('You are not authorised to view this report.');

    const decorated = await this.decorate(report);
    const evidenceRows = await this.evidence.find({ where: { reportId: id }, order: { createdAt: 'ASC' } });
    const history = await this.statusHistory.find({ where: { reportId: id }, order: { createdAt: 'ASC' } });
    if (reviewer) {
      return {
        ...decorated,
        evidence: evidenceRows,
        statusHistory: history,
        auditLog: await this.reportAudit.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      };
    }
    // Participants never see reviewer-only notes.
    return {
      ...decorated,
      discardNote: null,
      evidence: evidenceRows,
      statusHistory: history.map((h) => ({ ...h, note: null })),
      auditLog: [],
    };
  }

  async setPriority(id: string, dto: PriorityDto, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    await this.assertCanReview(report, user);
    if (!REPORT_PRIORITIES.includes(dto.priority as ReportPriority)) throw new BadRequestException('Invalid priority.');
    const previous = report.priority;
    report.priority = dto.priority as ReportPriority;
    await this.reports.save(report);
    await this.audit(id, 'REPORT_PRIORITY_CHANGED', user.username, `Priority ${previous} → ${report.priority}. ${dto.note || ''}`.trim(), {
      previous,
      updated: report.priority,
    });
    return this.get(id, user);
  }

  async dashboardCounts(queue: ReportQueue) {
    const rows = await this.reports
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.queue = :queue', { queue })
      .groupBy('r.status')
      .getRawMany();
    const counts: Record<string, number> = { new: 0, under_review: 0, awaiting_response: 0, resolved: 0, discarded: 0 };
    rows.forEach((row) => {
      counts[row.status] = Number(row.count) || 0;
    });
    return counts;
  }

  async restrictionsFor(competitionId: string, username: string) {
    const row = await this.restrictions.findOne({ where: { competitionId, username } });
    const discarded = await this.reports.count({
      where: { competitionId, reporterUsername: username, status: 'discarded' },
    });
    const count = Math.max(Number(row?.discardedCount || 0), discarded);
    return {
      competitionId,
      discardedCount: count,
      restricted: count >= MAX_DISCARDED_REPORTS,
      remaining: Math.max(0, MAX_DISCARDED_REPORTS - count),
    };
  }

  // ─── Discard ───────────────────────────────────────────────────────────────
  async discard(id: string, dto: DiscardReportDto, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    await this.assertCanReview(report, user);
    if (!REVIEW_STATUSES.includes(report.status)) {
      throw new BadRequestException('Only open reports can be discarded.');
    }
    if (!DISCARD_REASONS.includes(dto.reason as any)) throw new BadRequestException('Choose a valid discard reason.');
    if (dto.reason === 'other' && String(dto.note || '').trim().length < 10) {
      throw new BadRequestException('Explain the reason for discarding this report.');
    }

    await this.dataSource.transaction(async (manager) => {
      const reportRepo = manager.getRepository(ReportEntity);
      const fresh = await reportRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh || !REVIEW_STATUSES.includes(fresh.status)) {
        throw new BadRequestException('This report was already closed.');
      }
      fresh.status = 'discarded';
      fresh.discardReason = dto.reason;
      fresh.discardNote = dto.note || null;
      fresh.resolvedBy = user.username;
      fresh.resolvedAt = new Date();
      await reportRepo.save(fresh);

      const restrictionRepo = manager.getRepository(ReportingRestrictionEntity);
      let restriction = await restrictionRepo.findOne({
        where: { competitionId: fresh.competitionId, username: fresh.reporterUsername },
        lock: { mode: 'pessimistic_write' },
      });
      if (!restriction) {
        restriction = await restrictionRepo.save(
          restrictionRepo.create({ competitionId: fresh.competitionId, username: fresh.reporterUsername, discardedCount: 0 }),
        );
      }
      restriction.discardedCount = Number(restriction.discardedCount || 0) + 1;
      restriction.restricted = restriction.discardedCount >= MAX_DISCARDED_REPORTS;
      await restrictionRepo.save(restriction);

      await manager.getRepository(ReportStatusHistoryEntity).save(
        manager.getRepository(ReportStatusHistoryEntity).create({
          reportId: fresh.id,
          fromStatus: report.status,
          toStatus: 'discarded',
          actor: user.username,
          note: `${dto.reason}${dto.note ? ` — ${dto.note}` : ''}`,
        }),
      );
    });

    await this.audit(id, 'REPORT_DISCARDED', user.username, `Discarded: ${dto.reason}. ${dto.note || ''}`.trim(), { reason: dto.reason });
    await this.notifyUser(
      report.reporterUsername,
      'Report discarded',
      `Your report ${this.reportCode(report.id)} was discarded (${String(dto.reason).replace(/_/g, ' ')}). ${dto.note || ''}`.trim(),
      { reportId: report.id, compId: report.competitionId },
    );
    return this.get(id, user);
  }

  // ─── Case discussions ──────────────────────────────────────────────────────
  async startDiscussion(id: string, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    await this.assertCanReview(report, user);

    let discussion = await this.discussions.findOne({ where: { reportId: id } });
    if (discussion) return this.getDiscussion(discussion.id, user);
    if (report.status === 'discarded') throw new BadRequestException('A discarded report cannot be discussed.');

    discussion = await this.discussions.save(
      this.discussions.create({ reportId: id, status: 'open', createdBy: user.username }),
    );

    const people = [
      { username: user.username, role: 'reviewer' },
      { username: report.reporterUsername, role: 'reporter' },
      { username: report.reportedUsername, role: 'accused' },
    ];
    const seen = new Set<string>();
    for (const person of people) {
      if (!person.username || seen.has(person.username.toLowerCase())) continue;
      seen.add(person.username.toLowerCase());
      await this.participants.save(
        this.participants.create({ discussionId: discussion.id, username: person.username, role: person.role, addedBy: user.username }),
      );
    }

    const previous = report.status;
    report.status = 'under_review';
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: previous }, 'under_review', user.username, 'Case discussion opened.');

    const link = `/pages/case-discussion.html?discussionId=${discussion.id}`;
    await this.notifyUser(
      report.reporterUsername,
      'Case discussion opened',
      `Your report ${this.reportCode(report.id)} is under discussion. Enter the case room to explain what happened.`,
      { reportId: report.id, discussionId: discussion.id, link },
    );
    await this.notifyUser(
      report.reportedUsername,
      'Case discussion opened',
      `A report (${this.reportCode(report.id)}) was filed about you. Enter the case room to respond.`,
      { reportId: report.id, discussionId: discussion.id, link },
    );
    await this.audit(id, 'DISCUSSION_OPENED', user.username, 'Case discussion room created.', { discussionId: discussion.id });
    return this.getDiscussion(discussion.id, user);
  }

  private async loadDiscussionFor(discussionId: string, user: any) {
    const discussion = await this.discussions.findOne({ where: { id: discussionId } });
    if (!discussion) throw new NotFoundException('Case discussion not found.');
    const report = await this.reports.findOne({ where: { id: discussion.reportId } });
    if (!report) throw new NotFoundException('Report not found.');
    let reviewer = false;
    try {
      await this.assertCanReview(report, user);
      reviewer = true;
    } catch {
      reviewer = false;
    }
    const participant = await this.participants.findOne({
      where: { discussionId, username: String(user?.username || '') },
    });
    const hasAccess =
      reviewer ||
      participant ||
      [report.reporterUsername, report.reportedUsername].some(
        (name) => name.toLowerCase() === String(user?.username || '').toLowerCase(),
      );
    if (!hasAccess) throw new ForbiddenException('You are not a participant in this case discussion.');
    return { discussion, report, reviewer, participant };
  }

  async getDiscussion(discussionId: string, user: any) {
    const { discussion, report, reviewer } = await this.loadDiscussionFor(discussionId, user);
    const [people, messages, evidenceRows] = await Promise.all([
      this.participants.find({ where: { discussionId }, order: { createdAt: 'ASC' } }),
      this.messages.find({ where: { discussionId }, order: { createdAt: 'ASC' } }),
      this.evidence.find({ where: { reportId: report.id }, order: { createdAt: 'ASC' } }),
    ]);
    return {
      discussion,
      report: await this.decorate(report),
      participants: people,
      messages,
      evidence: evidenceRows,
      canModerate: reviewer,
      readOnly: discussion.status === 'ended',
    };
  }

  async listDiscussionsFor(username: string) {
    const rows = await this.participants.find({ where: { username }, order: { createdAt: 'DESC' } });
    const out: any[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const discussion = await this.discussions.findOne({ where: { id: row.discussionId } });
      if (!discussion) continue;
      const report = await this.reports.findOne({ where: { id: discussion.reportId } });
      if (!report) continue;
      seen.add(discussion.id);
      out.push({
        discussionId: discussion.id,
        status: discussion.status,
        reportId: report.id,
        code: this.reportCode(report.id),
        competitionId: report.competitionId,
        reasonCode: report.reasonCode,
        priority: report.priority,
        reportStatus: report.status,
        as: row.role,
        createdAt: discussion.createdAt,
      });
    }
    // The reporter and the accused always see their own case room, even if a
    // participant row was never materialised for them.
    const related = await this.reports.find({
      where: [{ reporterUsername: username }, { reportedUsername: username }],
    });
    for (const report of related) {
      const discussion = await this.discussions.findOne({ where: { reportId: report.id } });
      if (!discussion || seen.has(discussion.id)) continue;
      out.push({
        discussionId: discussion.id,
        status: discussion.status,
        reportId: report.id,
        code: this.reportCode(report.id),
        competitionId: report.competitionId,
        reasonCode: report.reasonCode,
        priority: report.priority,
        reportStatus: report.status,
        as: report.reportedUsername.toLowerCase() === String(username).toLowerCase() ? 'accused' : 'reporter',
        createdAt: discussion.createdAt,
      });
    }
    return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async postMessage(discussionId: string, dto: DiscussionMessageDto, user: any) {
    const { discussion, report } = await this.loadDiscussionFor(discussionId, user);
    if (discussion.status === 'ended') throw new BadRequestException('This discussion has ended and is read-only.');
    const body = String(dto.body || '').trim();
    if (!body) throw new BadRequestException('Message cannot be empty.');
    if (body.length > 2000) throw new BadRequestException('Message is too long (max 2000 characters).');
    const evidenceRows = this.validateEvidence(dto.evidence);

    const message = await this.messages.save(
      this.messages.create({
        discussionId,
        authorUsername: user.username,
        body,
        evidenceUrls: evidenceRows.map((e) => e.url),
      }),
    );

    // A reviewer question moves the case to "awaiting response".
    const isReviewer = await this.assertCanReview(report, user).then(() => true).catch(() => false);
    if (isReviewer && report.status === 'under_review') {
      report.status = 'awaiting_response';
      await this.reports.save(report);
      await this.recordStatus({ ...report, status: 'under_review' }, 'awaiting_response', user.username, 'Reviewer requested a response.');
      const others = await this.participants.find({ where: { discussionId } });
      await Promise.all(
        others
          .filter((p) => p.username.toLowerCase() !== String(user.username).toLowerCase())
          .map((p) =>
            this.notifyUser(p.username, 'Response requested in a case discussion', body.slice(0, 180), {
              reportId: report.id,
              discussionId,
            }),
          ),
      );
    }
    await this.audit(report.id, 'DISCUSSION_MESSAGE', user.username, `Message posted in case ${discussionId}.`, {
      discussionId,
      messageId: message.id,
    });
    return message;
  }

  async requestResponse(id: string, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    await this.assertCanReview(report, user);
    const discussion = await this.discussions.findOne({ where: { reportId: id } });
    if (!discussion || discussion.status === 'ended') {
      throw new BadRequestException('Open a case discussion before requesting a response.');
    }
    const previous = report.status;
    report.status = 'awaiting_response';
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: previous }, 'awaiting_response', user.username, 'Response requested.');
    await this.audit(id, 'RESPONSE_REQUESTED', user.username, 'Reviewer requested additional information.');
    return this.get(id, user);
  }

  async addParticipant(discussionId: string, dto: AddParticipantDto, user: any) {
    const { discussion, report } = await this.loadDiscussionFor(discussionId, user);
    await this.assertCanReview(report, user);
    if (discussion.status === 'ended') throw new BadRequestException('This discussion has ended.');
    const target = String(dto.username || '').trim().replace(/^@/, '');
    const targetUser = await this.users.findByUsername(target);
    if (!targetUser) throw new BadRequestException('This username does not exist.');
    const existing = await this.participants.findOne({ where: { discussionId, username: targetUser.username } });
    if (existing) throw new BadRequestException('That person is already a participant in this discussion.');
    // The room may only include people who actually play in the competition this
    // report belongs to. Membership is read from the team/roster records, never
    // from the username the client sent.
    const teams = await this.teams.find({ where: { competitionId: report.competitionId } });
    const inCompetition = teams.some(
      (team) =>
        String(team.leaderId || '').toLowerCase() === targetUser.username.toLowerCase() ||
        (team.memberUsernames || []).some(
          (member) => String(member).toLowerCase() === targetUser.username.toLowerCase(),
        ),
    );
    if (!inCompetition) {
      throw new BadRequestException('Only players registered in this competition can be added to its case discussion.');
    }
    const created = await this.participants.save(
      this.participants.create({
        discussionId,
        username: targetUser.username,
        role: dto.role || 'witness',
        addedBy: user.username,
      }),
    );
    await this.notifyUser(
      targetUser.username,
      'Added to a case discussion',
      `You were added to a case discussion for report ${this.reportCode(report.id)}.`,
      { reportId: report.id, discussionId },
    );
    await this.audit(report.id, 'DISCUSSION_PARTICIPANT_ADDED', user.username, `@${targetUser.username} added.`, { discussionId });
    return created;
  }

  async removeParticipant(discussionId: string, username: string, user: any) {
    const { discussion, report } = await this.loadDiscussionFor(discussionId, user);
    await this.assertCanReview(report, user);
    if (discussion.status === 'ended') throw new BadRequestException('This discussion has ended.');
    if (username.toLowerCase() === report.reportedUsername.toLowerCase() || username.toLowerCase() === report.reporterUsername.toLowerCase()) {
      throw new BadRequestException('The reporter and the accused cannot be removed from the case discussion.');
    }
    await this.participants.delete({ discussionId, username });
    await this.audit(report.id, 'DISCUSSION_PARTICIPANT_REMOVED', user.username, `@${username} removed.`, { discussionId });
    return { removed: true };
  }

  async endDiscussion(discussionId: string, user: any) {
    const { discussion, report } = await this.loadDiscussionFor(discussionId, user);
    await this.assertCanReview(report, user);
    if (discussion.status === 'ended') return this.getDiscussion(discussionId, user);
    discussion.status = 'ended';
    discussion.endedBy = user.username;
    discussion.endedAt = new Date();
    await this.discussions.save(discussion);
    const people = await this.participants.find({ where: { discussionId } });
    await Promise.all(
      people.map((p) =>
        this.notifyUser(p.username, 'Case discussion ended', `The discussion for ${this.reportCode(report.id)} is now read-only.`, {
          reportId: report.id,
          discussionId,
        }),
      ),
    );
    await this.audit(report.id, 'DISCUSSION_ENDED', user.username, 'Discussion ended; room is read-only.', { discussionId });
    return this.getDiscussion(discussionId, user);
  }

  // ─── Decisions ─────────────────────────────────────────────────────────────
  async actOnPlayer(id: string, dto: PlayerDecisionDto, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    if (report.queue !== 'organiser') throw new ForbiddenException('This report is handled by the Community Moderator.');
    await this.assertCanReview(report, user);
    if (!REVIEW_STATUSES.includes(report.status)) throw new BadRequestException('This report is already closed.');
    if (!ORGANISER_ACTIONS.includes(dto.action as ReportAction)) throw new BadRequestException('Invalid action.');
    const conclusion = String(dto.conclusion || '').trim();
    if (conclusion.length < 15) throw new BadRequestException('A conclusion explaining the decision is required.');

    const player = await this.users.findByUsername(report.reportedUsername);
    if (!player) throw new NotFoundException('The reported player no longer exists.');

    if (dto.action === 'remove_from_competition') {
      await this.removePlayerFromCompetition(report, user.username);
    } else if (dto.action === 'warning') {
      // One unified warning action. Historical formal/final rows are untouched.
      await this.users.update(player.id, { warningCount: Number(player.warningCount || 0) + 1 });
      await this.notifyUser(player.username, 'Warning', conclusion, {
        reportId: report.id,
        compId: report.competitionId,
      });
    }

    report.finding = dto.finding as any;
    report.action = dto.action as ReportAction;
    report.conclusion = conclusion;
    report.status = 'resolved';
    report.resolvedBy = user.username;
    report.resolvedAt = new Date();
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: 'new' }, 'resolved', user.username, `Finding: ${dto.finding}; action: ${dto.action}.`);
    await this.audit(id, 'REPORT_DECIDED', user.username, `Player decision: ${dto.finding} / ${dto.action}.`, {
      finding: dto.finding,
      action: dto.action,
      reportedUsername: report.reportedUsername,
    });
    if (dto.action !== 'no_action') {
      await this.reputation
        .evaluate(
          report.reportedUsername,
          {
            mediumViolations: dto.finding === 'substantiated' && ['harassment', 'discrimination'].includes(report.reasonCode) ? 1 : 0,
            reason: `Report ${this.reportCode(report.id)} decision: ${dto.finding}.`,
            reportId: report.id,
          },
          user.username,
        )
        .catch(() => undefined);
    }
    return this.get(id, user);
  }

  /**
   * Revokes participation and transfers leadership as one transaction.
   *
   * The removed player keeps their account and report/appeal access, but the
   * persisted removal row blocks every competition/team endpoint afterwards.
   * If no eligible player remains, the team is left without an active leader
   * (empty leader fields) so nobody can manage it until it is resolved.
   */
  private async removePlayerFromCompetition(report: ReportEntity, actor: string) {
    const teams = await this.teams.find({ where: { competitionId: report.competitionId } });
    const team =
      teams.find((t) => String(t.leaderId || '').toLowerCase() === report.reportedUsername.toLowerCase()) ||
      teams.find((t) => (t.memberUsernames || []).some((m) => String(m).toLowerCase() === report.reportedUsername.toLowerCase()));
    if (!team) throw new BadRequestException('This player is not currently on a team in this competition.');

    const removedKey = report.reportedUsername.toLowerCase();
    const allUsers = await this.users.findAll();

    // Succession is decided from the LOCKED roster row inside the transaction:
    // concurrent removals can never promote a player who is being removed by
    // the other request, and only one request can win the leadership write.
    let remaining: string[] = [];
    let leaderLeaving = false;
    let successor: any = null;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TeamEntity);
      const fresh = await repo.findOne({ where: { id: team.id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh) throw new NotFoundException('Team not found.');

      const currentLeader = String(fresh.leaderId || '').toLowerCase();
      leaderLeaving = currentLeader === removedKey;
      remaining = (fresh.memberUsernames || []).filter((m) => String(m).toLowerCase() !== removedKey);
      fresh.memberUsernames = remaining;

      const removalRepo = manager.getRepository(CompetitionRemovalEntity);
      const removedRows = await removalRepo.find({ where: { competitionId: report.competitionId } });
      const removedKeys = new Set(removedRows.map((row) => String(row.username).toLowerCase()));
      removedKeys.add(removedKey);

      // Existing roster order decides succession. Banned, removed and staff
      // accounts are skipped — never promote a removed or ineligible player.
      if (leaderLeaving) {
        successor = remaining
          .map((name) => allUsers.find((u: any) => String(u.username).toLowerCase() === String(name).toLowerCase()))
          .find((u: any) => u && !u.banned && !removedKeys.has(String(u.username).toLowerCase())) || null;
      }

      if (leaderLeaving) {
        fresh.leaderId = successor ? successor.username : '';
        fresh.leaderUsername = successor ? successor.username : '';
        fresh.createdBy = successor ? successor.username : '';
      }
      await repo.save(fresh);

      const existing = await removalRepo.findOne({
        where: { competitionId: report.competitionId, username: report.reportedUsername },
      });
      if (!existing) {
        await removalRepo.save(removalRepo.create({
          competitionId: report.competitionId,
          username: report.reportedUsername,
          removedBy: actor,
          reportId: report.id,
          reason: report.conclusion || `Removed by organiser decision on report ${report.id}.`,
        }));
      }

      const usersRepo = manager.getRepository(UserEntity);
      if (leaderLeaving) {
        // The removed leader loses leadership permissions immediately.
        const removedUser = allUsers.find((u: any) => String(u.username).toLowerCase() === removedKey);
        if (removedUser && String(removedUser.role).toLowerCase() === 'team_lead') {
          await usersRepo.update(removedUser.id, { role: UserRole.PARTICIPANT } as any);
        }
      }
      if (successor) {
        const promoted = allUsers.find((u: any) => String(u.username).toLowerCase() === String(successor.username).toLowerCase());
        if (promoted && ['participant', 'regular', 'team_lead'].includes(String(promoted.role).toLowerCase())) {
          await usersRepo.update(promoted.id, { role: UserRole.TEAM_LEAD } as any);
        }
      }
    });

    const reason = String(report.conclusion || '').trim();
    await this.auditLog.record('TEAM_MEMBER_REMOVED', {
      actor,
      entityType: 'team',
      entityId: team.id,
      details: `@${report.reportedUsername} removed by organiser decision on report ${this.reportCode(report.id)}.`
        + (successor ? ` Leadership transferred to @${successor.username}.` : (leaderLeaving ? ' No eligible player remained, so the team has no active leader.' : '')),
      metadata: {
        competitionId: report.competitionId,
        teamId: team.id,
        reportId: report.id,
        removedBy: actor,
        removedLeader: leaderLeaving ? report.reportedUsername : null,
        newLeader: successor ? successor.username : null,
        reason,
      },
    });
    if (leaderLeaving) {
      await this.auditLog.record('TEAM_LEADERSHIP_TRANSFERRED', {
        actor,
        entityType: 'team',
        entityId: team.id,
        details: successor
          ? `@${report.reportedUsername} was removed from the competition by @${actor}. @${successor.username} was automatically promoted to Team Leader.`
          : `@${report.reportedUsername} was removed from the competition by @${actor}. No eligible player remained, so the team has no active leader.`,
        metadata: {
          competitionId: report.competitionId,
          teamId: team.id,
          reportId: report.id,
          removedLeader: report.reportedUsername,
          newLeader: successor ? successor.username : null,
          removedBy: actor,
          reason,
        },
      });
    }

    await this.notifyUser(
      report.reportedUsername,
      'Removed from competition',
      `You were removed from "${report.competitionId}" following report ${this.reportCode(report.id)}. You can no longer access its team or competition management features, but you can still view your reports and report the organiser.`,
      { reportId: report.id, compId: report.competitionId },
    );
    if (successor) {
      const others = remaining.filter((m) => String(m).toLowerCase() !== String(successor.username).toLowerCase());
      await this.notifyUser(
        successor.username,
        'You Are Now the Team Leader',
        'The previous Team Leader has been removed from the competition. You have automatically been promoted to Team Leader. You now have access to Team Leader functionality.',
        { compId: report.competitionId, teamId: team.id },
      );
      await Promise.all(
        others.map((member) =>
          this.notifyUser(member, 'Team Leadership Updated', `${successor.username} is now the Team Leader of your team.`, {
            compId: report.competitionId,
            teamId: team.id,
          }),
        ),
      );
    }
  }

  async actOnOrganiser(id: string, dto: ModeratorDecisionDto, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    if (report.queue !== 'moderator') throw new ForbiddenException('Only reports against organisers are handled here.');
    await this.assertCanReview(report, user);
    if (!REVIEW_STATUSES.includes(report.status)) throw new BadRequestException('This report is already closed.');
    if (!MODERATOR_ACTIONS.includes(dto.action as ReportAction)) throw new BadRequestException('Invalid action.');
    const conclusion = String(dto.conclusion || '').trim();
    if (conclusion.length < 15) throw new BadRequestException('A conclusion explaining the decision is required.');
    if (dto.finding === 'unsubstantiated' && !['no_action', 'warning'].includes(dto.action)) {
      throw new BadRequestException('An unsubstantiated finding cannot justify a punitive action.');
    }
    const organiser = report.reportedUsername;

    if (dto.action === 'reputation_downgrade') {
      if (!dto.level) throw new BadRequestException('Choose the reputation level for the downgrade.');
      await this.reputation.applyDowngrade(organiser, dto.level, conclusion, report.id, user.username);
    } else if (dto.action === 'creation_restriction') {
      await this.reputation.issueSanction(organiser, 'creation_restriction', conclusion, {
        reportId: report.id,
        days: Number(dto.days || 30),
        appliedBy: user.username,
      });
    } else if (dto.action === 'competition_suspension') {
      await this.reputation.issueSanction(organiser, 'competition_suspension', conclusion, {
        reportId: report.id,
        days: Number(dto.days || 30),
        appliedBy: user.username,
      });
      const comp: any = await this.competitions.findById(report.competitionId).catch(() => null);
      if (comp) {
        await this.competitions.update(report.competitionId, { status: 'suspended' } as any);
      }
    } else if (dto.action === 'warning') {
      // A warning alone never changes reputation.
      await this.reputation.issueSanction(organiser, 'warning', conclusion, {
        reportId: report.id,
        appliedBy: user.username,
      });
    }

    report.finding = dto.finding as any;
    report.action = dto.action as ReportAction;
    report.conclusion = conclusion;
    report.status = 'resolved';
    report.resolvedBy = user.username;
    report.resolvedAt = new Date();
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: 'new' }, 'resolved', user.username, `Finding: ${dto.finding}; action: ${dto.action}.`);
    await this.audit(id, 'REPORT_DECIDED', user.username, `Organiser decision: ${dto.finding} / ${dto.action}.`, {
      finding: dto.finding,
      action: dto.action,
      level: dto.level || null,
      organiser,
    });
    await this.notifyUser(
      organiser,
      'Decision on a report about your competition',
      `${this.reportCode(report.id)}: ${dto.finding.replace(/_/g, ' ')}. ${conclusion}`,
      { reportId: report.id, compId: report.competitionId },
    );
    return this.get(id, user);
  }

  // ─── Investigation (Community Moderator) ───────────────────────────────────
  async investigation(id: string, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    if (report.queue !== 'moderator') throw new ForbiddenException('Only organiser reports have an investigation page.');
    if (!this.isModerator(user)) throw new ForbiddenException('Community Moderator access required.');

    const organiser = report.reportedUsername;
    const [profile, comp, teams, matches, evidenceRows, related, history, sanctionsCount, substantiated] = await Promise.all([
      this.reputation.getProfile(organiser),
      this.competitions.findById(report.competitionId).catch(() => null),
      this.teams.find({ where: { competitionId: report.competitionId } }),
      this.matches.find({ where: { competitionId: report.competitionId }, order: { scheduledAt: 'DESC' }, take: 50 }),
      this.evidence.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.reports.find({
        where: { reportedUsername: organiser },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.statusHistory.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.reputation.getHistory(organiser),
      this.reports.count({
        where: { reportedUsername: organiser, status: 'resolved', finding: In(['substantiated', 'partially_substantiated']) },
      }),
    ]);

    const chatRows = await this.chat.find({
      where: [{ competitionId: report.competitionId, channel: 'general' }, { competitionId: report.competitionId, channel: 'announcements' }],
      order: { createdAt: 'DESC' },
      take: 60,
    });
    let financial: any[] = [];
    try {
      financial = await this.dataSource.query(
        'SELECT * FROM "revenue_transactions" WHERE "competitionId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
        [report.competitionId],
      );
    } catch {
      financial = [];
    }

    const auditRows = await this.auditRows
      .createQueryBuilder('a')
      .where('a."entityId" = :compId', { compId: report.competitionId })
      .orWhere('a.metadata ->> \'compId\' = :compId', { compId: report.competitionId })
      .orWhere('a."entityType" = :type AND a."entityId" = :organiser', { type: 'organiser_reputation', organiser })
      .orderBy('a."createdAt"', 'ASC')
      .take(200)
      .getMany();

    const timeline = [
      ...auditRows.map((row) => ({
        at: row.createdAt,
        type: row.actionType,
        actor: row.actor,
        details: row.details,
        source: 'audit',
      })),
      ...history.map((row) => ({
        at: row.createdAt,
        type: 'REPORT_STATUS',
        actor: row.actor,
        details: `${row.fromStatus || 'new'} → ${row.toStatus}${row.note ? ` — ${row.note}` : ''}`,
        source: 'report',
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      report: await this.decorate(report),
      evidence: evidenceRows,
      organiser: {
        username: organiser,
        profile,
        substantiatedReports: substantiated,
        warnings: sanctionsCount.sanctions.filter((s) => ['warning', 'formal_warning', 'final_warning'].includes(s.type)).length,
        activeRestrictions: profile.activeSanctions,
        reputationHistory: sanctionsCount.reputationHistory,
        sanctions: sanctionsCount.sanctions,
      },
      competition: comp,
      teams,
      matches,
      chat: chatRows.slice().reverse(),
      financial,
      relatedReports: related.filter((r) => r.id !== id),
      timeline,
    };
  }

  // ─── Deadlines / escalation ────────────────────────────────────────────────
  async escalateOverdue(): Promise<{ reminded: number; escalated: number }> {
    const setting = await this.dataSource
      .query(`SELECT "value" FROM "platform_settings" WHERE "key" = 'report_reminder_minutes' LIMIT 1`)
      .then((rows: any[]) => Number(rows?.[0]?.value || 0))
      .catch(() => 0);
    const reminderMinutes = setting > 0 ? setting : 24 * 60;
    const cutoff = new Date(Date.now() - reminderMinutes * 60 * 1000);
    const stale = await this.reports.find({
      where: { queue: 'organiser', status: In(['new', 'under_review', 'awaiting_response']) },
      take: 100,
    });
    let reminded = 0;
    let escalated = 0;
    for (const report of stale) {
      if (new Date(report.updatedAt || report.createdAt).getTime() > cutoff.getTime()) continue;
      if (report.priority === 'high' && !report.relatedReportId) {
        // High-priority reports get a second platform-level reminder (never a reroute).
        const staff = await this.users.findAll();
        const platform = staff.filter((u: any) =>
          ['super_admin', 'admin'].includes(String(u.role || '').toLowerCase()),
        );
        await Promise.all(
          platform.map((u: any) =>
            this.notifications
              .create({
                toUsername: u.username,
                type: 'report-escalation',
                title: '⏰ High-priority report overdue',
                body: `Report ${this.reportCode(report.id)} has had no organiser action for ${Math.round(reminderMinutes / 60)}h.`,
                meta: { reportId: report.id, compId: report.competitionId },
              })
              .catch(() => undefined),
          ),
        );
        escalated += 1;
      } else {
        const organizers = await this.organizersOf(report.competitionId).catch(() => []);
        await Promise.all(
          organizers.map((name) =>
            this.notifications
              .create({
                toUsername: name,
                type: 'report-reminder',
                title: '⏰ Report awaiting your review',
                body: `Report ${this.reportCode(report.id)} is still open. Please discard, discuss or act on it.`,
                meta: { reportId: report.id, compId: report.competitionId },
              })
              .catch(() => undefined),
          ),
        );
        reminded += 1;
      }
      await this.audit(report.id, 'REPORT_DEADLINE_SWEEP', 'system', 'Report exceeded its review deadline and was escalated.');
    }
    return { reminded, escalated };
  }

  async getConfigValues() {
    const rows: any[] = await this.dataSource
      .query(`SELECT "key", "value" FROM "platform_settings" WHERE "key" LIKE 'report_%'`)
      .catch(() => []);
    return rows.reduce((acc: Record<string, string>, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }
}
