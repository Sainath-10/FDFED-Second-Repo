import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
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
import { LifecycleService } from '../payments/lifecycle.service';
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
/** Organiser decisions with a real restriction can be appealed once and uplifted. */
const APPEALABLE_ACTIONS = new Set(['reputation_downgrade', 'creation_restriction', 'competition_suspension', 'formal_warning', 'final_warning']);
/** Organiser decisions against a player that the player can appeal to the Community Moderator. */
const PLAYER_APPEALABLE_ACTIONS = new Set(['remove_from_competition', 'warning', 'formal_warning', 'final_warning']);
const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();
/** Actions shown in the Community Moderator activity timeline (no message noise). */
const MODERATION_ACTIVITY_ACTIONS = [
  'REPORT_PRIORITY_CHANGED',
  'REPORT_DISCARDED',
  'REPORT_DECIDED',
  'DISCUSSION_OPENED',
  'DISCUSSION_ENDED',
  'DISCUSSION_PARTICIPANT_ADDED',
  'DISCUSSION_PARTICIPANT_REMOVED',
  'RESPONSE_REQUESTED',
  'APPEAL_UPHELD',
  'APPEAL_DISCARDED',
  'APPEAL_DISCUSSION_OPENED',
  'ACTION_UPLIFTED',
  'REPORT_DEADLINE_SWEEP',
];
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
    @Optional() private readonly lifecycle?: LifecycleService,
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
    const history = this.decisionHistoryOf(report);
    const latestDecision = history.length ? history[history.length - 1] : null;
    const appealUsed = this.appealUsed(report);
    const room = await this.discussions.findOne({ where: { reportId: report.id } });
    return {
      ...report,
      code: this.reportCode(report.id),
      // The Enter Discussion action is only offered once this room exists,
      // which can only happen after a reviewer explicitly opens it.
      discussionId: room?.id || null,
      discussionStatus: room?.status || null,
      decisionHistory: history,
      latestDecision,
      appealUsed,
      // The affected person (organiser or accused player) may appeal once; the
      // workflow is fixed by the report's queue, not by the client.
      canAppeal: this.appealBlocker(report) === null,
      appealKind: this.appealTypeFor(report),
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
    const [rows, playerAppeals] = await Promise.all([
      this.reports.find({ where, order: { createdAt: 'DESC' }, take: 200 }),
      // Player appeals (organiser-queue reports) reach the Community Moderator only through an appeal.
      this.reports.find({ where: { queue: 'organiser', appealType: 'player', appealStatus: In(['submitted', 'deciding']) }, order: { appealedAt: 'DESC' }, take: 200 }),
    ]);
    return Promise.all([...rows, ...playerAppeals].map((row) => this.decorate(row)));
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
    const counts: Record<string, number> = { new: 0, under_review: 0, awaiting_response: 0, resolved: 0, discarded: 0, appealed: 0 };
    rows.forEach((row) => {
      counts[row.status] = Number(row.count) || 0;
    });
    counts.appealed = await this.reports.count({ where: { queue, status: 'resolved', appealStatus: 'submitted', uplifted: false } });
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
    if (discussion) {
      // "Discuss" is also the explicit reopen action after a decision/appeal:
      // reuse the same room and preserve every existing message.
      if (discussion.status === 'ended') {
        discussion.status = 'open';
        discussion.endedBy = null;
        discussion.endedAt = null;
        await this.discussions.save(discussion);
        await this.audit(id, 'DISCUSSION_REOPENED', user.username, 'Case discussion reopened by the reviewer.', { discussionId: discussion.id });
      }
      return this.getDiscussion(discussion.id, user);
    }
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
        // The Case Discussions tab renders the same complete card as Reports.
        report: await this.decorate(report),
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
        report: await this.decorate(report),
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
        evidence: evidenceRows.map((e) => ({ url: e.url, filename: e.filename, mimetype: e.mimetype, size: e.sizeBytes })),
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
    } else {
      // Every other participant hears about a new message (once per message).
      const others = await this.participants.find({ where: { discussionId } });
      await this.notifyMany(
        others.map((p) => p.username).filter((name) => lower(name) !== lower(user.username)),
        `New message in ${this.reportCode(report.id)}`,
        `@${user.username}: ${body.slice(0, 160)}`,
        { reportId: report.id, discussionId, link: `/pages/case-discussion.html?discussionId=${discussionId}` },
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

  /** A decision locks the room immediately, while keeping its full history readable. */
  private async lockDiscussionForDecision(reportId: string, user: any, note: string) {
    const discussion = await this.discussions.findOne({ where: { reportId } });
    if (!discussion || discussion.status === 'ended') return;
    discussion.status = 'ended';
    discussion.endedBy = user.username;
    discussion.endedAt = new Date();
    await this.discussions.save(discussion);
    const people = await this.participants.find({ where: { discussionId: discussion.id } });
    await Promise.all(
      people.map((p) =>
        this.notifyUser(p.username, 'Case discussion closed', note, {
          reportId,
          discussionId: discussion.id,
        }),
      ),
    );
    await this.audit(reportId, 'DISCUSSION_ENDED', user.username, note, {
      discussionId: discussion.id,
      lockedByDecision: true,
    });
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

    const priorDecision = this.decisionHistoryOf(report).slice(-1)[0] || null;
    report.finding = dto.finding as any;
    report.action = dto.action as ReportAction;
    report.conclusion = conclusion;
    report.status = 'resolved';
    report.resolvedBy = user.username;
    report.resolvedAt = new Date();
    this.pushDecision(report, { finding: dto.finding, action: dto.action, conclusion, decidedBy: user.username });
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: 'new' }, 'resolved', user.username, `Finding: ${dto.finding}; action: ${dto.action}.`);
    await this.lockDiscussionForDecision(id, user, 'A decision was recorded. The discussion is now read-only.');
    await this.audit(id, 'REPORT_DECIDED', user.username, `Player decision: ${dto.finding} / ${dto.action}.`, {
      finding: dto.finding,
      action: dto.action,
      previousFinding: priorDecision?.finding || null,
      previousAction: priorDecision?.action || null,
      reportedUsername: report.reportedUsername,
    });
    await this.auditLog.record('REPORT_DECIDED', {
      actor: user.username, entityType: 'report', entityId: id,
      details: `Organiser decision on ${this.reportCode(id)}: ${dto.finding} / ${String(dto.action).replace(/_/g, ' ')}.`,
      metadata: { competitionId: report.competitionId, reportId: id, finding: dto.finding, action: dto.action, reportedUsername: report.reportedUsername },
    });
    const code = this.reportCode(id);
    const link = '/pages/my-reports.html';
    await this.notifyUser(report.reporterUsername, 'Decision on your report',
      `${code}: ${dto.finding} — ${String(dto.action).replace(/_/g, ' ')}.`, { reportId: id, compId: report.competitionId, link });
    if (dto.action !== 'remove_from_competition') {
      await this.notifyUser(report.reportedUsername, 'Decision on a report about you',
        `${code}: ${dto.finding} — ${String(dto.action).replace(/_/g, ' ')}.${PLAYER_APPEALABLE_ACTIONS.has(dto.action) ? ' You can appeal it once from your Reports page.' : ''}`,
        { reportId: id, compId: report.competitionId, link });
    }
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
    // Everything this removal changes, so a reverted decision can restore it exactly.
    const snapshot: Record<string, any> = { teamId: team.id, index: -1, wasLeader: false, previousRole: null, successor: null, successorPreviousRole: null };

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TeamEntity);
      const fresh = await repo.findOne({ where: { id: team.id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh) throw new NotFoundException('Team not found.');

      const currentLeader = String(fresh.leaderId || '').toLowerCase();
      leaderLeaving = currentLeader === removedKey;
      snapshot.index = (fresh.memberUsernames || []).findIndex((m) => String(m).toLowerCase() === removedKey);
      snapshot.wasLeader = leaderLeaving;
      snapshot.previousRole = allUsers.find((u: any) => String(u.username).toLowerCase() === removedKey)?.role || null;
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
      if (successor) {
        snapshot.successor = successor.username;
        snapshot.successorPreviousRole = successor.role || null;
      }
      if (!existing) {
        await removalRepo.save(removalRepo.create({
          competitionId: report.competitionId,
          username: report.reportedUsername,
          removedBy: actor,
          reportId: report.id,
          reason: report.conclusion || `Removed by organiser decision on report ${report.id}.`,
          restoreSnapshot: snapshot,
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
      `You were removed from "${report.competitionId}" following report ${this.reportCode(report.id)}. You can no longer access its team or competition management features, but you can still view your reports and appeal this decision once from your Reports page.`,
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
    let suspendedFrom: string | null = null;
    if (dto.finding === 'unsubstantiated' && !['no_action', 'warning'].includes(dto.action)) {
      throw new BadRequestException('An unsubstantiated finding cannot justify a punitive action.');
    }
    let termination: Record<string, any> | null = null;
    const organiser = report.reportedUsername;
    const previousLevel = (await this.reputation.getOrCreate(organiser).catch(() => null))?.level || null;

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
        suspendedFrom = comp.status;
        await this.competitions.update(report.competitionId, { status: 'suspended' } as any);
      }
    } else if (dto.action === 'competition_termination') {
      // Ends the competition now: players are refunded from escrow and the
      // organiser forfeits part of the prize pool. Cannot be uplifted.
      if (!report.competitionId) throw new BadRequestException('This report is not linked to a competition.');
      if (!this.lifecycle) throw new BadRequestException('Competition payments are unavailable, so it cannot be ended here.');
      termination = await this.lifecycle.terminateForMisconduct(report.competitionId, user, conclusion);
      await this.reputation.issueSanction(organiser, 'warning', `Competition ended by the Community Moderator: ${conclusion}`, {
        reportId: report.id,
        appliedBy: user.username,
      });
    } else if (dto.action === 'warning') {
      // A warning alone never changes reputation.
      await this.reputation.issueSanction(organiser, 'warning', conclusion, {
        reportId: report.id,
        appliedBy: user.username,
      });
    }

    const isCorrection = this.decisionHistoryOf(report).length > 0;
    const priorDecision = this.decisionHistoryOf(report).slice(-1)[0] || null;
    report.finding = dto.finding as any;
    report.action = dto.action as ReportAction;
    report.conclusion = conclusion;
    report.status = 'resolved';
    report.resolvedBy = user.username;
    report.resolvedAt = new Date();
    this.pushDecision(report, {
      finding: dto.finding,
      action: dto.action,
      level: dto.level || null,
      days: dto.days || null,
      conclusion,
      decidedBy: user.username,
      previousLevel,
      suspendedFrom,
      termination,
    });
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: 'new' }, 'resolved', user.username, `Finding: ${dto.finding}; action: ${dto.action}.`);
    await this.lockDiscussionForDecision(id, user, 'A decision was recorded. The discussion is now read-only.');
    await this.audit(id, 'REPORT_DECIDED', user.username, `Organiser decision: ${dto.finding} / ${dto.action}.`, {
      finding: dto.finding,
      action: dto.action,
      previousFinding: priorDecision?.finding || null,
      previousAction: priorDecision?.action || null,
      level: dto.level || null,
      organiser,
      reportedUsername: organiser,
    });
    await this.notifyUser(
      organiser,
      isCorrection ? 'Corrected decision recorded' : 'Decision on a report about your competition',
      isCorrection
        ? `A corrected decision was recorded for ${this.reportCode(report.id)}: ${dto.finding.replace(/_/g, ' ')} — ${String(dto.action).replace(/_/g, ' ')}. ${conclusion}`
        : `${this.reportCode(report.id)}: ${dto.finding.replace(/_/g, ' ')}. ${conclusion}`,
      { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' },
    );
    return this.get(id, user);
  }

  // ─── Decision history, appeals and uplift ──────────────────────────────────
  private decisionHistoryOf(report: ReportEntity): Array<Record<string, any>> {
    const history = Array.isArray(report.decisionHistory) ? report.decisionHistory : [];
    if (history.length || !report.finding || !report.action) return history;
    // Reports decided before versioning: the current decision is synthesised from the report.
    return [{
      version: 1,
      finding: report.finding,
      action: report.action,
      conclusion: report.conclusion || '',
      decidedBy: report.resolvedBy || 'system',
      decidedAt: report.resolvedAt || report.updatedAt,
      status: report.uplifted ? 'uplifted' : 'active',
      legacy: true,
    }];
  }

  private pushDecision(report: ReportEntity, decision: Record<string, any>) {
    const history = this.decisionHistoryOf(report).map((row) => (row.status === 'active' ? { ...row, status: 'superseded' } : row));
    history.push({ version: history.length + 1, decidedAt: new Date().toISOString(), status: 'active', ...decision });
    report.decisionHistory = history;
    // A new decision is a new active version: the report is no longer in an
    // uplifted state, so it must become visible in Activity Logs again and its
    // restrictions are judged on this decision only.
    report.uplifted = false;
    report.upliftReason = null;
    report.upliftedBy = null;
    report.upliftedAt = null;
    report.competitionDisposition = null;
  }

  private appealUsed(report: ReportEntity): boolean {
    return Number(report.appealCount || 0) > 0 || !!report.appealedAt || !!report.appealStatus;
  }

  /** Opens (or reopens) the one discussion room attached to a report. */
  private async ensureRoom(
    report: ReportEntity,
    reviewer: string,
    people: Array<{ username: string; role: string }>,
    actor: string,
    reopen = false,
  ) {
    let room = report.appealDiscussionId
      ? await this.discussions.findOne({ where: { id: report.appealDiscussionId } })
      : null;
    if (!room) room = await this.discussions.findOne({ where: { reportId: report.id } });
    if (!room) {
      room = await this.discussions.save(this.discussions.create({ reportId: report.id, status: 'open', createdBy: actor }));
    } else if (reopen && room.status === 'ended') {
      room.status = 'open';
      room.endedBy = null;
      room.endedAt = null;
      await this.discussions.save(room);
    }
    const existing = await this.participants.find({ where: { discussionId: room.id } });
    const known = new Set(existing.map((row) => lower(row.username)));
    for (const person of [{ username: reviewer, role: 'reviewer' }, ...people]) {
      if (!person.username || known.has(lower(person.username))) continue;
      known.add(lower(person.username));
      await this.participants.save(this.participants.create({ discussionId: room.id, username: person.username, role: person.role, addedBy: actor }));
    }
    return room;
  }

  // ─── Appeals ────────────────────────────────────────────────────────────────
  //
  // Two independent workflows share the moderator's Appealed tab. The type is
  // derived on the server from the original report — never from the UI:
  //   organiser appeal: report.queue === 'moderator' (player vs organiser); the
  //     organiser appeals the Community Moderator's decision.
  //   player appeal:    report.queue === 'organiser' (player vs player / team
  //     leader); the accused player appeals the organiser's decision.
  // An organiser appeal never reaches the reinstatement code, and a player
  // appeal never reaches the organiser uplift code.

  private appealTypeFor(report: ReportEntity): 'organiser' | 'player' {
    return report.queue === 'moderator' ? 'organiser' : 'player';
  }

  private async moderatorUsernames(): Promise<string[]> {
    const all = await this.users.findAll();
    return all
      .filter((u: any) => !u.banned && ['community_moderator', 'super_admin'].includes(String(u.role || '').toLowerCase()))
      .map((u: any) => u.username);
  }

  /** Notifies each username once per call (case-insensitive), skipping blanks. */
  private async notifyMany(usernames: string[], title: string, body: string, meta: Record<string, any> = {}) {
    const seen = new Set<string>();
    for (const name of usernames) {
      const key = lower(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      await this.notifyUser(name, title, body, meta);
    }
  }

  /** Why the affected person cannot appeal this report now, or null when they can. */
  private appealBlocker(report: ReportEntity, username?: string): string | null {
    if (username && lower(report.reportedUsername) !== lower(username)) {
      return report.queue === 'moderator'
        ? 'Only the organiser affected by this decision can appeal it.'
        : 'Only the player affected by this decision can appeal it.';
    }
    if (report.status !== 'resolved') return 'This decision is not active.';
    if (this.appealUsed(report)) return 'This decision has already been appealed once.';
    const history = this.decisionHistoryOf(report);
    const latest = history.length ? history[history.length - 1] : null;
    if (latest && latest.status !== 'active') return 'This decision is no longer active.';
    if (report.queue === 'moderator') {
      if (report.uplifted) return 'This decision was already uplifted.';
      if (!APPEALABLE_ACTIONS.has(String(report.action || ''))) return 'A normal warning or a no-action decision cannot be appealed.';
      return null;
    }
    if (!PLAYER_APPEALABLE_ACTIONS.has(String(report.action || ''))) return 'Only a warning or a removal from the competition can be appealed.';
    return null;
  }

  /**
   * The affected person appeals a decision once, with a reason. The decision
   * stays in force until a Community Moderator decides the appeal. Submission
   * is claimed atomically, so a double click or a retry cannot file twice.
   */
  async appeal(id: string, user: any, reasonInput?: string) {
    const reason = String(reasonInput || '').trim();
    if (reason.length < 10) throw new BadRequestException('Explain the reason for your appeal (at least 10 characters).');
    if (reason.length > 2000) throw new BadRequestException('The reason is too long (max 2000 characters).');
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    const blocker = this.appealBlocker(report, user?.username);
    if (blocker) throw (blocker.startsWith('Only the') ? new ForbiddenException(blocker) : new BadRequestException(blocker));

    const type = this.appealTypeFor(report);
    const claimed = await this.reports.createQueryBuilder()
      .update(ReportEntity)
      .set({
        appealStatus: 'submitted',
        appealType: type,
        appealReason: reason,
        appealCount: () => '"appealCount" + 1',
        appealedAt: () => 'now()',
      } as any)
      .where('id = :id AND "appealStatus" IS NULL AND "appealCount" = 0 AND "appealedAt" IS NULL AND status = :status', { id, status: 'resolved' })
      .execute();
    if (!claimed.affected) throw new BadRequestException('This decision has already been appealed once.');
    const fresh = await this.reports.findOneOrFail({ where: { id } });
    const code = this.reportCode(report.id);
    const moderators = await this.moderatorUsernames();

    if (type === 'organiser') {
      // An appeal never reopens the room. If a discussion already exists it
      // stays exactly as it was (normally read-only) until a reviewer clicks
      // Discuss; if none exists, no room is fabricated here.
      const room = await this.discussions.findOne({ where: { reportId: id } });
      if (room) {
        fresh.appealDiscussionId = room.id;
        await this.reports.save(fresh);
      }
      await this.recordStatus(fresh, 'resolved', user.username, 'Appeal submitted. The decision remains active while it is reviewed.');
      await this.audit(id, 'APPEAL_SUBMITTED', user.username, `Organiser appeal submitted: ${reason}`, {
        appealType: type,
        discussionId: room?.id || null,
      });
      await this.auditLog.record('APPEAL_SUBMITTED', {
        actor: user.username, entityType: 'report', entityId: id, details: `Organiser appealed the decision on ${code}.`,
        metadata: { competitionId: report.competitionId, reportId: id, appealType: type, reason },
      });
      await this.notifyMany(moderators, 'Organiser Appealed a Decision',
        `An Organiser has appealed the decision for report ${code}. Open the Appealed reports tab and click Discuss to reopen the case room. Reason: "${reason.slice(0, 160)}".`,
        { reportId: id, ...(room ? { discussionId: room.id } : {}), link: '/pages/moderator/reports.html' });
      await this.notifyUser(user.username, 'Appeal submitted',
        `Your appeal for ${code} was sent to the Community Moderator. The decision stays active until it is reviewed.`,
        {
          reportId: id,
          ...(room ? { discussionId: room.id } : {}),
          link: room ? `/pages/case-discussion.html?discussionId=${room.id}` : '/pages/my-reports.html',
        });
      return { discussionId: room?.id || null, discussion: room, report: await this.decorate(fresh) };
    }

    // Player appeal: routed to the Community Moderator. The organiser's room is
    // reused (never duplicated) when the moderator chooses Discuss.
    await this.recordStatus(fresh, 'resolved', user.username, "Appeal submitted. The organiser's decision remains in force while it is reviewed.");
    await this.audit(id, 'APPEAL_SUBMITTED', user.username, `Player appeal submitted: ${reason}`, { appealType: type });
    await this.auditLog.record('APPEAL_SUBMITTED', {
      actor: user.username, entityType: 'report', entityId: id, details: `@${user.username} appealed the organiser decision on ${code}.`,
      metadata: { competitionId: report.competitionId, reportId: id, appealType: type, reason },
    });
    await this.notifyMany(moderators, 'Player appealed an organiser decision',
      `@${user.username} appealed the organiser's decision on ${code}: "${reason.slice(0, 160)}". It is in the Appealed tab.`,
      { reportId: id, link: '/pages/moderator/reports.html' });
    await this.notifyMany(await this.organizersOf(report.competitionId).catch(() => []), 'A decision was appealed',
      `@${user.username} appealed your decision on ${code}. A Community Moderator will review it; the decision stays in force meanwhile.`,
      { reportId: id, compId: report.competitionId, link: '/pages/my-reports.html' });
    await this.notifyUser(user.username, 'Appeal submitted',
      `Your appeal for ${code} was sent to the Community Moderator. The decision stays in force until it is reviewed.`,
      { reportId: id, link: '/pages/my-reports.html' });
    return { discussionId: null, discussion: null, report: await this.decorate(fresh) };
  }

  /**
   * Reverses an organiser-workflow decision: only the restrictions created by
   * THAT decision are undone, the decision history is kept, and the original
   * report reopens as `reopenAs`. The report transition is claimed with one
   * conditional UPDATE, so two concurrent uplifts cannot both succeed.
   */
  private async revertOrganiserDecision(
    report: ReportEntity,
    reason: string,
    user: any,
    reopenAs: ReportStatus,
    competitionDisposition: string | undefined,
  ) {
    if (report.queue !== 'moderator') throw new BadRequestException('Only decisions against an organiser can be uplifted.');

    // Always judge the CURRENT persisted decision, never a stale copy.
    const current = await this.reports.findOne({ where: { id: report.id } });
    if (!current) throw new NotFoundException('Report not found.');
    const history = this.decisionHistoryOf(current);
    const active = history.length ? history[history.length - 1] : null;
    if (active && active.status === 'uplifted') throw new BadRequestException('This decision was already uplifted.');
    if (!active || active.status !== 'active') throw new BadRequestException('There is no active decision to uplift.');
    if (current.status !== 'resolved') throw new BadRequestException('This decision is no longer active.');
    if (!APPEALABLE_ACTIONS.has(String(active.action || ''))) throw new BadRequestException('This decision has no restriction to uplift.');

    let disposition: string | null = null;
    if (active.action === 'competition_suspension') {
      disposition = competitionDisposition === 'reopen' ? 'reopen' : 'remain_terminated';
    }

    // Claim the transition before touching any sanction. This is the lock that
    // makes a duplicate or concurrent uplift fail instead of reversing twice.
    const claim = await this.reports
      .createQueryBuilder()
      .update(ReportEntity)
      .set({
        status: reopenAs,
        uplifted: true,
        upliftReason: reason,
        upliftedBy: user.username,
        upliftedAt: new Date(),
        competitionDisposition: disposition,
        finding: null,
        action: null,
        conclusion: null,
        resolvedBy: null,
        resolvedAt: null,
        ...(current.appealStatus === 'submitted' ? { appealStatus: 'resolved' } : {}),
      } as any)
      .where('id = :id AND status = :status AND uplifted = false', { id: current.id, status: 'resolved' })
      .execute();
    if (!claim.affected) throw new BadRequestException('This decision is no longer active or has already been uplifted.');

    try {
      await this.reputation.revertDecision(
        current.reportedUsername,
        current.id,
        active.action === 'reputation_downgrade' ? (active.previousLevel || null) : null,
        `Uplifted decision on ${this.reportCode(current.id)}: ${reason}`,
        user.username,
      );
      if (active.action === 'competition_suspension' && disposition === 'reopen') {
        await this.competitions.update(current.competitionId, {
          status: active.suspendedFrom && active.suspendedFrom !== 'suspended' ? active.suspendedFrom : 'active',
        } as any).catch(() => undefined);
      }
    } catch (err) {
      // Never leave the report reopened if reversing its restrictions failed.
      await this.reports
        .createQueryBuilder()
        .update(ReportEntity)
        .set({
          status: 'resolved',
          uplifted: false,
          upliftReason: null,
          upliftedBy: null,
          upliftedAt: null,
          competitionDisposition: null,
          finding: active.finding || null,
          action: active.action || null,
          conclusion: active.conclusion || null,
          resolvedBy: current.resolvedBy,
          resolvedAt: current.resolvedAt,
        } as any)
        .where('id = :id AND status = :reopenAs', { id: current.id, reopenAs })
        .execute()
        .catch(() => undefined);
      throw err;
    }

    active.status = 'uplifted';
    active.upliftedBy = user.username;
    active.upliftReason = reason;
    active.upliftedAt = new Date().toISOString();
    active.competitionDisposition = disposition;

    // Keep the caller's entity in sync (callers save it again to stamp the
    // appeal outcome), then persist the versioned history.
    report.decisionHistory = [...history.slice(0, -1), active];
    report.status = reopenAs;
    report.finding = null;
    report.action = null;
    report.conclusion = null;
    report.uplifted = true;
    report.upliftReason = reason;
    report.upliftedBy = user.username;
    report.upliftedAt = new Date();
    report.competitionDisposition = disposition;
    report.resolvedBy = null;
    report.resolvedAt = null;
    if (report.appealStatus === 'submitted') report.appealStatus = 'resolved';
    await this.reports.save(report);

    await this.recordStatus({ ...report, status: current.status }, reopenAs, user.username, `Previous action uplifted: ${reason}`);
    const room = await this.discussions.findOne({ where: { reportId: report.id } });
    if (room && room.status === 'ended') {
      room.status = 'open';
      await this.discussions.save(room);
    }
    await this.audit(report.id, 'ACTION_UPLIFTED', user.username, `${active.action} uplifted. ${reason}`, {
      disposition,
      previousFinding: active.finding || null,
      previousAction: active.action || null,
      reportedUsername: report.reportedUsername,
    });
    await this.auditLog.record('ORGANISER_RESTRICTION_REMOVED', {
      actor: user.username, entityType: 'organiser_reputation', entityId: report.reportedUsername,
      details: `${String(active.action).replace(/_/g, ' ')} on ${this.reportCode(report.id)} was reverted: ${reason}`,
      metadata: { competitionId: report.competitionId, reportId: report.id, action: active.action, disposition },
    });
    return active;
  }

  /** A Community Moderator reverses the current decision and reopens the report (existing Uplift). */
  async uplift(id: string, dto: { reason: string; competitionDisposition?: string }, user: any) {
    if (!this.isModerator(user)) throw new ForbiddenException('Only a Community Moderator can uplift an action.');
    const reason = String(dto?.reason || '').trim();
    if (reason.length < 15) throw new BadRequestException('Give a reason of at least 15 characters to uplift an action.');
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    if (report.queue !== 'moderator') throw new BadRequestException('Only decisions against an organiser can be uplifted.');
    const appealPending = report.appealStatus === 'submitted';
    await this.revertOrganiserDecision(report, reason, user, 'new', dto.competitionDisposition);
    if (appealPending) {
      report.appealOutcome = 'reverted';
      report.appealDecisionReason = reason;
      report.appealDecidedBy = user.username;
      report.appealDecidedAt = new Date();
      await this.reports.save(report);
    }
    await this.notifyUser(report.reportedUsername, 'Decision Uplifted',
      `The Community Moderator has uplifted the previous decision for report ${this.reportCode(report.id)}. The restrictions associated with that decision have been removed, and the report has been reopened for review.`,
      { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' });
    return this.get(id, user);
  }

  /**
   * The Community Moderator decides an appeal: 'revert' undoes the original
   * decision, 'discard' keeps it. The appeal is claimed atomically, so two
   * moderators (or a retried request) can never apply a decision twice.
   */
  async decideAppeal(id: string, dto: { action: string; reason: string }, user: any) {
    if (!this.isModerator(user)) throw new ForbiddenException('Only a Community Moderator can decide an appeal.');
    const action = String(dto?.action || '');
    if (!['revert', 'discard'].includes(action)) throw new BadRequestException('Choose Revert the Decision or Discard.');
    const reason = String(dto?.reason || '').trim();
    if (reason.length < 10) throw new BadRequestException('Explain your decision (at least 10 characters).');
    if (reason.length > 2000) throw new BadRequestException('The reason is too long (max 2000 characters).');

    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    const type = report.appealType || this.appealTypeFor(report);
    const wanted = action === 'revert' ? 'reverted' : 'discarded';
    if (report.appealStatus !== 'submitted') {
      // Idempotent: the same decision arriving twice returns the recorded result.
      if (report.appealOutcome === wanted) return this.decorate(report);
      throw new BadRequestException(report.appealOutcome ? 'This appeal was already decided.' : 'There is no pending appeal on this report.');
    }

    const claimed = await this.reports.createQueryBuilder()
      .update(ReportEntity)
      .set({ appealStatus: 'deciding' } as any)
      .where('id = :id AND "appealStatus" = :pending', { id, pending: 'submitted' })
      .execute();
    if (!claimed.affected) throw new BadRequestException('Another moderator is deciding this appeal right now.');

    try {
      const fresh = await this.reports.findOneOrFail({ where: { id } });
      fresh.appealStatus = 'submitted'; // replaced by the final status when the decision completes
      if (action === 'discard') return await this.discardAppeal(fresh, type, reason, user);
      return type === 'organiser'
        ? await this.revertOrganiserAppeal(fresh, reason, user)
        : await this.revertPlayerAppeal(fresh, reason, user);
    } catch (err) {
      // Release the claim so the appeal can be decided again.
      await this.reports.createQueryBuilder()
        .update(ReportEntity)
        .set({ appealStatus: 'submitted' } as any)
        .where('id = :id AND "appealStatus" = :deciding', { id, deciding: 'deciding' })
        .execute()
        .catch(() => undefined);
      throw err;
    }
  }

  private stampAppealDecision(report: ReportEntity, outcome: 'reverted' | 'discarded', reason: string, user: any) {
    report.appealStatus = 'resolved';
    report.appealOutcome = outcome;
    report.appealDecisionReason = reason;
    report.appealDecidedBy = user.username;
    report.appealDecidedAt = new Date();
  }

  private async discardAppeal(report: ReportEntity, type: string, reason: string, user: any) {
    this.stampAppealDecision(report, 'discarded', reason, user);
    await this.reports.save(report);
    const code = this.reportCode(report.id);
    await this.recordStatus(report, report.status, user.username, `Appeal discarded; the original decision stays in force. ${reason}`);
    const activeDecision = this.decisionHistoryOf(report).slice(-1)[0] || null;
    await this.audit(report.id, 'APPEAL_DISCARDED', user.username, `Appeal discarded: ${reason}`, {
      appealType: type,
      previousFinding: activeDecision?.finding || null,
      previousAction: activeDecision?.action || null,
      reportedUsername: report.reportedUsername,
    });
    await this.auditLog.record('APPEAL_DISCARDED', {
      actor: user.username, entityType: 'report', entityId: report.id,
      details: `Appeal on ${code} discarded; the original decision stays in force.`,
      metadata: { competitionId: report.competitionId, reportId: report.id, appealType: type, reason },
    });
    if (type === 'organiser') {
      await this.notifyUser(report.reportedUsername, 'Appeal discarded — restrictions retained',
        `The Community Moderator discarded your appeal on ${code}. The original decision and its restrictions remain in force. Reason: ${reason}`,
        { reportId: report.id, link: '/pages/my-reports.html' });
    } else {
      const organizers = await this.organizersOf(report.competitionId).catch(() => []);
      await this.notifyUser(report.reportedUsername, 'Appeal discarded',
        `The Community Moderator discarded your appeal on ${code}. The organiser's decision remains in force. Reason: ${reason}`,
        { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' });
      await this.notifyMany([...organizers, report.reporterUsername], 'Appeal discarded',
        `The appeal on ${code} was discarded. The original decision remains in force.`,
        { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' });
    }
    return this.decorate(report);
  }

  /** Organiser appeal → Revert: same reversal as Uplift; the original report returns to New. */
  private async revertOrganiserAppeal(report: ReportEntity, reason: string, user: any) {
    if (report.queue !== 'moderator') throw new BadRequestException('This is not an organiser appeal.');
    // Reopening a suspended competition restores the organiser's access to it.
    const active = await this.revertOrganiserDecision(report, reason, user, 'new', 'reopen');
    this.stampAppealDecision(report, 'reverted', reason, user);
    await this.reports.save(report);
    const code = this.reportCode(report.id);
    await this.audit(report.id, 'APPEAL_UPHELD', user.username, `Appeal upheld; ${active.action} reverted and the report reopened as New. ${reason}`, {
      appealType: 'organiser',
      previousFinding: active.finding || null,
      previousAction: active.action || null,
      reportedUsername: report.reportedUsername,
    });
    await this.notifyUser(report.reportedUsername, 'Decision Uplifted',
      `The Community Moderator has uplifted the previous decision for report ${code}. The restrictions associated with that decision have been removed, and the report has been reopened for review. Reason: ${reason}`,
      { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' });
    await this.notifyUser(report.reporterUsername, 'Decision reverted on appeal',
      `The decision on your report ${code} was reverted on appeal. The original report was reopened as New.`,
      { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' });
    return this.decorate(report);
  }

  /** Player appeal → Revert: undo exactly what the organiser's decision did. */
  private async revertPlayerAppeal(report: ReportEntity, reason: string, user: any) {
    if (report.queue !== 'organiser') throw new BadRequestException('This is not a player appeal.');
    const history = this.decisionHistoryOf(report);
    const active = history.length ? history[history.length - 1] : null;
    if (!active || active.status !== 'active') throw new BadRequestException('There is no active decision to revert.');
    const action = String(active.action || report.action || '');
    const code = this.reportCode(report.id);
    let restored: Record<string, any> | null = null;

    if (action === 'remove_from_competition') {
      restored = await this.restoreRemovedPlayer(report, user.username, reason);
    } else if (['warning', 'formal_warning', 'final_warning'].includes(action)) {
      const player = await this.users.findByUsername(report.reportedUsername);
      if (player) await this.users.update(player.id, { warningCount: Math.max(0, Number(player.warningCount || 0) - 1) } as any);
    } else {
      throw new BadRequestException('This decision has no consequence to revert.');
    }

    const previousStatus = report.status;
    active.status = 'uplifted';
    active.revertedBy = user.username;
    active.revertReason = reason;
    active.revertedAt = new Date().toISOString();
    active.upliftedBy = user.username;
    active.upliftReason = reason;
    active.upliftedAt = active.revertedAt;
    report.decisionHistory = [...history.slice(0, -1), active];
    // The original report is reopened (never duplicated) so both the organiser
    // and the Community Moderator see it as unresolved again.
    report.status = 'new';
    report.finding = null;
    report.action = null;
    report.conclusion = null;
    report.resolvedBy = null;
    report.resolvedAt = null;
    report.uplifted = true;
    report.upliftReason = reason;
    report.upliftedBy = user.username;
    report.upliftedAt = new Date();
    this.stampAppealDecision(report, 'reverted', reason, user);
    await this.reports.save(report);
    await this.recordStatus({ ...report, status: previousStatus }, 'new', user.username, `Organiser decision (${action}) reverted on appeal; report reopened. ${reason}`);
    await this.audit(report.id, 'APPEAL_UPHELD', user.username, `Appeal upheld; ${action} reverted. ${reason}`, {
      appealType: 'player',
      previousFinding: active.finding || null,
      previousAction: action,
      reportedUsername: report.reportedUsername,
      restored,
    });
    await this.auditLog.record('DECISION_REVERTED', {
      actor: user.username, entityType: 'report', entityId: report.id,
      details: `Organiser decision (${action.replace(/_/g, ' ')}) on ${code} reverted on appeal: ${reason}`,
      metadata: { competitionId: report.competitionId, reportId: report.id, appealType: 'player', action, restored },
    });

    const organizers = await this.organizersOf(report.competitionId).catch(() => []);
    const reinstated = action === 'remove_from_competition';
    await this.notifyUser(report.reportedUsername, reinstated ? 'You were reinstated into the competition' : 'Decision reverted',
      reinstated
        ? `Your appeal on ${code} was upheld. You are back on your team${restored?.wasLeader ? ' as Team Leader' : ''} with your previous access, and the report was reopened as New. Reason: ${reason}`
        : `Your appeal on ${code} was upheld and the warning was removed. The report was reopened as New. Reason: ${reason}`,
      { reportId: report.id, compId: report.competitionId, teamId: restored?.teamId, link: '/pages/my-reports.html' });
    await this.notifyMany([...organizers, report.reporterUsername], 'Decision reverted on appeal',
      `The Community Moderator reverted the organiser's decision on ${code}${reinstated ? ` and reinstated @${report.reportedUsername}` : ''}. The report was reopened as New.`,
      { reportId: report.id, compId: report.competitionId, link: '/pages/my-reports.html' });
    return this.decorate(report);
  }

  /**
   * Puts a removed player back exactly as they were, in one transaction: same
   * team, same roster position, same team role and account role, and the
   * removal record that blocked their access is deleted. If they were the Team
   * Leader, leadership returns to them and the automatically promoted player
   * steps down, so there is never more than one leader.
   */
  private async restoreRemovedPlayer(report: ReportEntity, actor: string, reason: string) {
    const username = report.reportedUsername;
    const key = lower(username);
    const removalRepo = this.dataSource.getRepository(CompetitionRemovalEntity);
    const removal = await removalRepo.createQueryBuilder('r')
      .where('r."competitionId" = :competitionId', { competitionId: report.competitionId })
      .andWhere('lower(r.username) = :username', { username: key })
      .getOne();
    if (!removal) throw new BadRequestException('This player is no longer removed from the competition.');

    // Snapshot from the removal; removals made before snapshots existed fall back to the audit trail.
    let snap: Record<string, any> = removal.restoreSnapshot || {};
    if (!snap.teamId) {
      const rows = await this.auditRows.createQueryBuilder('a')
        .where('a."actionType" IN (:...types)', { types: ['TEAM_MEMBER_REMOVED', 'TEAM_LEADERSHIP_TRANSFERRED'] })
        .andWhere("a.metadata ->> 'reportId' = :reportId", { reportId: report.id })
        .getMany();
      const removed = rows.find((r) => r.actionType === 'TEAM_MEMBER_REMOVED');
      const transfer = rows.find((r) => r.actionType === 'TEAM_LEADERSHIP_TRANSFERRED');
      snap = {
        teamId: removed?.metadata?.teamId || removed?.entityId || report.reportedTeamId || null,
        index: -1,
        wasLeader: !!(transfer?.metadata?.removedLeader || removed?.metadata?.removedLeader),
        previousRole: null,
        successor: transfer?.metadata?.newLeader || removed?.metadata?.newLeader || null,
        successorPreviousRole: null,
      };
    }
    if (!snap.teamId) throw new BadRequestException("The player's original team could not be determined.");

    const result: Record<string, any> = { teamId: snap.teamId, wasLeader: !!snap.wasLeader, demoted: null };
    await this.dataSource.transaction(async (manager) => {
      const teamRepo = manager.getRepository(TeamEntity);
      const team = await teamRepo.findOne({ where: { id: snap.teamId }, lock: { mode: 'pessimistic_write' } });
      if (!team) throw new BadRequestException('The original team no longer exists, so the player cannot be reinstated.');
      if (team.competitionId !== report.competitionId) throw new BadRequestException('The original team belongs to another competition.');
      const status = String(team.status || '').toLowerCase();
      if (['banned', 'rejected', 'disbanded'].includes(status)) {
        throw new BadRequestException(`The original team is ${status}, so the player cannot be reinstated into it.`);
      }

      // A player can be on only one team per competition.
      const others = await teamRepo.find({ where: { competitionId: report.competitionId } });
      const elsewhere = others.find((t) => t.id !== team.id && (t.memberUsernames || []).some((m) => lower(m) === key));
      if (elsewhere) throw new BadRequestException(`@${username} has since joined another team in this competition.`);

      const members = (team.memberUsernames || []).filter(Boolean);
      if (!members.some((m) => lower(m) === key)) {
        const index = Number.isInteger(snap.index) && snap.index >= 0 ? Math.min(snap.index, members.length) : members.length;
        members.splice(index, 0, username);
      }
      team.memberUsernames = members;

      const usersRepo = manager.getRepository(UserEntity);
      const playerRow = await usersRepo.createQueryBuilder('u').where('lower(u.username) = :k', { k: key }).getOne();
      const staffRoles = ['admin', 'super_admin', 'finance_moderator', 'community_moderator'];

      if (snap.wasLeader) {
        const currentLeader = team.leaderId || team.leaderUsername || '';
        team.leaderId = username;
        team.leaderUsername = username;
        team.createdBy = username;
        if (currentLeader && lower(currentLeader) !== key) {
          result.demoted = currentLeader;
          // The interim leader steps down; their account role goes back unless they still lead another team.
          const stillLeads = (await teamRepo.find()).some((t) => t.id !== team.id && lower(t.leaderId) === lower(currentLeader));
          if (!stillLeads) {
            const interim = await usersRepo.createQueryBuilder('u').where('lower(u.username) = :k', { k: lower(currentLeader) }).getOne();
            if (interim && String(interim.role).toLowerCase() === 'team_lead') {
              const back = lower(snap.successor) === lower(currentLeader) && snap.successorPreviousRole && !staffRoles.includes(String(snap.successorPreviousRole))
                ? snap.successorPreviousRole
                : UserRole.PARTICIPANT;
              await usersRepo.update(interim.id, { role: back } as any);
            }
          }
        }
        if (playerRow && !staffRoles.includes(String(playerRow.role).toLowerCase())) {
          await usersRepo.update(playerRow.id, { role: UserRole.TEAM_LEAD } as any);
        }
      } else if (playerRow && snap.previousRole && !staffRoles.includes(String(snap.previousRole))
        && String(playerRow.role).toLowerCase() !== String(snap.previousRole).toLowerCase()) {
        await usersRepo.update(playerRow.id, { role: snap.previousRole } as any);
      }

      await teamRepo.save(team);
      await manager.getRepository(CompetitionRemovalEntity).delete({ id: removal.id });
      // Same transaction: the reinstatement and its audit entry commit together or not at all.
      const auditRepo = manager.getRepository(AuditLogEntity);
      await auditRepo.save(auditRepo.create({
        actionType: 'TEAM_MEMBER_REINSTATED',
        actor,
        entityType: 'team',
        entityId: team.id,
        details: `@${username} reinstated to ${team.name} after the removal on ${this.reportCode(report.id)} was reverted on appeal.`
          + (snap.wasLeader ? ` Team Leader role restored${result.demoted ? `; @${result.demoted} stepped down` : ''}.` : ''),
        metadata: {
          competitionId: report.competitionId, teamId: team.id, reportId: report.id, username,
          rosterIndex: members.findIndex((m) => lower(m) === key), wasLeader: !!snap.wasLeader,
          previousLeader: result.demoted, reason,
        },
      }));
      result.teamName = team.name;
      result.members = members.slice();
    });

    if (result.demoted) {
      await this.notifyUser(result.demoted, 'Team leadership returned',
        `@${username} was reinstated to ${result.teamName} as Team Leader after an appeal. You are no longer the Team Leader.`,
        { compId: report.competitionId, teamId: result.teamId });
    }
    const teammates = (result.members || []).filter((m: string) => lower(m) !== key && lower(m) !== lower(result.demoted));
    await this.notifyMany(teammates, 'Teammate reinstated',
      `@${username} was reinstated to ${result.teamName} after an appeal${snap.wasLeader ? ' and is Team Leader again' : ''}.`,
      { compId: report.competitionId, teamId: result.teamId });
    return result;
  }

  /**
   * Moderator "Discuss". Organiser appeals: the report's own room (existing).
   * Player appeals: the SAME room the organiser used for the report, with the
   * organiser(s), reporter, accused player and the moderator; everyone is
   * notified when the moderator joins or reopens it.
   */
  async appealRoom(id: string, user: any) {
    if (!this.isModerator(user)) throw new ForbiddenException('Community Moderator access is required.');
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    if (report.queue === 'moderator') {
      const room = await this.ensureRoom(report, report.resolvedBy || user.username, [
        { username: report.reportedUsername, role: 'accused' },
        { username: report.reporterUsername, role: 'reporter' },
      ], user.username, true);
      if (report.appealDiscussionId !== room.id) {
        report.appealDiscussionId = room.id;
        await this.reports.save(report);
      }
      return { discussionId: room.id, discussion: room };
    }

    if (!report.appealStatus || (report.appealType || 'player') !== 'player') {
      throw new BadRequestException('This report has no player appeal to discuss.');
    }
    const before = await this.discussions.findOne({ where: { reportId: report.id } });
    const wasJoined = before
      ? !!(await this.participants.createQueryBuilder('p')
        .where('p."discussionId" = :d', { d: before.id })
        .andWhere('lower(p.username) = :u', { u: lower(user.username) })
        .getOne())
      : false;
    const wasEnded = before?.status === 'ended';
    const organizers = await this.organizersOf(report.competitionId).catch(() => []);
    const room = await this.ensureRoom(report, report.resolvedBy || organizers[0] || user.username, [
      ...organizers.map((name) => ({ username: name, role: 'reviewer' })),
      { username: report.reporterUsername, role: 'reporter' },
      { username: report.reportedUsername, role: 'accused' },
      { username: user.username, role: 'moderator' },
    ], user.username, true);
    if (report.appealDiscussionId !== room.id) {
      report.appealDiscussionId = room.id;
      await this.reports.save(report);
    }
    if (!before || !wasJoined || wasEnded) {
      const link = `/pages/case-discussion.html?discussionId=${room.id}`;
      const people = await this.participants.find({ where: { discussionId: room.id } });
      await this.notifyMany(
        people.map((p) => p.username).filter((name) => lower(name) !== lower(user.username)),
        'Appeal discussion opened',
        `A Community Moderator ${wasEnded ? 'reopened' : 'joined'} the discussion for the appeal on ${this.reportCode(report.id)}.`,
        { reportId: report.id, discussionId: room.id, link },
      );
      await this.audit(report.id, 'APPEAL_DISCUSSION_OPENED', user.username, `Moderator ${wasEnded ? 'reopened' : 'joined'} the appeal discussion.`, { discussionId: room.id });
    }
    return { discussionId: room.id, discussion: room };
  }

  /** The reporter or the organiser enters the same appeal room, read-only if closed. */
  async organiserAppealRoom(id: string, user: any) {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    const me = lower(user?.username);
    if (me !== lower(report.reportedUsername) && me !== lower(report.reporterUsername)) {
      throw new ForbiddenException('You are not authorised to view this appeal.');
    }
    const room = await this.discussions.findOne({ where: { reportId: id } });
    if (!room) {
      throw new BadRequestException('The Community Moderator has not opened a discussion for this appeal yet.');
    }
    if (report.appealDiscussionId !== room.id) {
      report.appealDiscussionId = room.id;
      await this.reports.save(report);
    }
    return { discussionId: room.id, discussion: room };
  }

  /**
   * Community Moderator case view: the selected report's discussion, its
   * discussion activity, and the competition's persisted chronological
   * timeline. Available for any report in the moderator's activity log.
   */
  async caseView(id: string, user: any) {
    if (!this.isModerator(user)) throw new ForbiddenException('Community Moderator access is required.');
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');

    const room = await this.discussions.findOne({ where: { reportId: id } });
    const [participants, messages, evidenceRows, statusRows, reportAuditRows, teams] = await Promise.all([
      room ? this.participants.find({ where: { discussionId: room.id }, order: { createdAt: 'ASC' } }) : Promise.resolve([]),
      room ? this.messages.find({ where: { discussionId: room.id }, order: { createdAt: 'ASC' } }) : Promise.resolve([]),
      this.evidence.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.statusHistory.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.reportAudit.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.teams.find({ where: { competitionId: report.competitionId } }),
    ]);
    const competitionEvents = await this.competitionTimeline(report.competitionId, teams.map((t) => t.id));
    const timeline = [
      ...competitionEvents,
      ...statusRows.map((row) => ({
        at: row.createdAt, type: 'REPORT_STATUS', actor: row.actor,
        details: `${this.reportCode(id)}: ${row.fromStatus || 'new'} → ${row.toStatus}${row.note ? ` — ${row.note}` : ''}`,
        reason: row.note || null, reportId: id, source: 'report',
      })),
      ...reportAuditRows.map((row: any) => ({
        at: row.createdAt, type: row.action, actor: row.actor,
        details: `${this.reportCode(id)}: ${row.details || ''}`,
        reason: row.metadata?.reason || row.metadata?.conclusion || null,
        reportId: id, source: 'report',
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const discussionActivity = reportAuditRows
      .filter((row: any) => String(row.action || '').startsWith('DISCUSSION_'))
      .map((row: any) => ({
        id: row.id, at: row.createdAt, action: row.action, actor: row.actor,
        details: row.details, reason: row.metadata?.reason || null,
      }));

    return {
      report: await this.decorate(report),
      discussion: room ? { ...room, participants, messages } : null,
      discussionActivity,
      evidence: evidenceRows,
      timeline,
    };
  }

  /**
   * Appeal "View" bundle: the original discussion (messages, participants,
   * evidence) and the competition's audit timeline.
   */
  async appealDetails(id: string, user: any) {
    if (!this.isModerator(user)) throw new ForbiddenException('Community Moderator access is required.');
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');
    if (!report.appealStatus) throw new BadRequestException('This report has not been appealed.');

    const room = await this.discussions.findOne({ where: { reportId: report.id } });
    const [participants, messages, evidenceRows, statusRows, reportAuditRows, teams] = await Promise.all([
      room ? this.participants.find({ where: { discussionId: room.id }, order: { createdAt: 'ASC' } }) : Promise.resolve([]),
      room ? this.messages.find({ where: { discussionId: room.id }, order: { createdAt: 'ASC' } }) : Promise.resolve([]),
      this.evidence.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.statusHistory.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.reportAudit.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
      this.teams.find({ where: { competitionId: report.competitionId } }),
    ]);
    const timeline = await this.competitionTimeline(report.competitionId, teams.map((t) => t.id));
    const merged = [
      ...timeline,
      ...statusRows.map((row) => ({
        at: row.createdAt, type: 'REPORT_STATUS', actor: row.actor,
        details: `${this.reportCode(id)}: ${row.fromStatus || 'new'} → ${row.toStatus}${row.note ? ` — ${row.note}` : ''}`, source: 'report',
      })),
      ...reportAuditRows.map((row: any) => ({
        at: row.createdAt, type: row.action, actor: row.actor, details: `${this.reportCode(id)}: ${row.details || ''}`, source: 'report',
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      report: await this.decorate(report),
      discussion: room ? { ...room, participants, messages } : null,
      evidence: evidenceRows,
      timeline: merged,
    };
  }

  /** Audit events about a competition: the competition itself, its teams, and anything tagged with its id. */
  private async competitionTimeline(competitionId: string, teamIds: string[]) {
    const qb = this.auditRows.createQueryBuilder('a')
      .where('a."entityId" = :compId', { compId: competitionId })
      .orWhere("a.metadata ->> 'compId' = :compId", { compId: competitionId })
      .orWhere("a.metadata ->> 'competitionId' = :compId", { compId: competitionId });
    if (teamIds.length) qb.orWhere('a."entityId" IN (:...teamIds)', { teamIds });
    const rows = await qb.orderBy('a."createdAt"', 'ASC').take(500).getMany();
    return rows.map((row) => ({
      at: row.createdAt,
      type: row.actionType,
      actor: row.actor,
      details: row.details,
      reason: row.metadata?.reason || null,
      reportId: row.metadata?.reportId || (row.entityType === 'report' ? row.entityId : null),
      source: 'audit',
    }));
  }

  /** Whether the signed-in player was removed from a competition, and why. */
  async removalStatus(competitionId: string, user: any) {
    const row = await this.dataSource.getRepository(CompetitionRemovalEntity)
      .createQueryBuilder('r')
      .where('r."competitionId" = :competitionId', { competitionId })
      .andWhere('lower(r.username) = :username', { username: lower(user?.username) })
      .getOne();
    return { removed: !!row, removedAt: row?.createdAt || null, reason: row?.reason || '' };
  }

  /** Every report in one competition, for its organisers (moderators also see organiser reports). */
  async forCompetition(competitionId: string, user: any) {
    const organizers = await this.organizersOf(competitionId);
    const me = lower(user?.username);
    const moderator = this.isModerator(user);
    if (!moderator && !organizers.some((o) => lower(o) === me)) {
      throw new ForbiddenException('Only an organiser of this competition can view its reports.');
    }
    const rows = await this.reports.find({ where: { competitionId }, order: { createdAt: 'DESC' }, take: 200 });
    const visible = rows
      .filter((row) => lower(row.reportedUsername) !== me)
      .filter((row) => moderator || row.queue === 'organiser');
    return Promise.all(visible.map((row) => this.decorate(row)));
  }

  /** Reports a Community Moderator closed. Moderators see their own; a Super Admin may open anyone's. */
  async moderatorActivity(username: string | undefined, user: any) {
    const target = String(username || user?.username || '').trim();
    const viewerIsSuper = String(user?.role || '') === UserRole.SUPER_ADMIN;
    if (!viewerIsSuper && lower(target) !== lower(user?.username)) {
      throw new ForbiddenException('You cannot access another moderator’s activity.');
    }
    const account: any = await this.users.findByUsername(target);
    if (!account || (account.role !== UserRole.COMMUNITY_MODERATOR && account.adminType !== UserRole.COMMUNITY_MODERATOR)) {
      throw new NotFoundException('That account is not a Community Moderator.');
    }
    // The timeline is the append-only report audit trail, not a derived list of
    // currently-resolved reports. Reopened or uplifted cases keep their history.
    const [auditRows, rawCounts] = await Promise.all([
      this.reportAudit
        .createQueryBuilder('a')
        .where('lower(a.actor) = :target', { target: lower(target) })
        .andWhere('a.action IN (:...actions)', { actions: MODERATION_ACTIVITY_ACTIONS })
        .orderBy('a."createdAt"', 'DESC')
        .take(400)
        .getMany(),
      this.reportAudit
        .createQueryBuilder('a')
        .select("COUNT(DISTINCT CASE WHEN a.action = 'REPORT_DECIDED' THEN a.\"reportId\" END)", 'resolved')
        .addSelect("COUNT(DISTINCT CASE WHEN a.action = 'REPORT_DISCARDED' THEN a.\"reportId\" END)", 'discarded')
        .addSelect('COUNT(DISTINCT a."reportId")', 'total')
        .where('lower(a.actor) = :target', { target: lower(target) })
        .andWhere('a.action IN (:...actions)', { actions: MODERATION_ACTIVITY_ACTIONS })
        .getRawOne(),
    ]);

    const reportIds = [...new Set(auditRows.map((row) => row.reportId).filter(Boolean))];
    const reportRows = reportIds.length
      ? await this.reports.find({ where: { id: In(reportIds) } })
      : [];
    const byId = new Map(reportRows.map((report) => [report.id, report]));
    const competitionNames = new Map<string, string>();
    for (const competitionId of new Set(reportRows.map((report) => report.competitionId).filter(Boolean))) {
      const competition = await this.competitions.findById(competitionId).catch(() => null);
      if (competition) competitionNames.set(competition.id, competition.name);
    }

    const activities = auditRows.map((row) => {
      const report = row.reportId ? byId.get(row.reportId) : null;
      const meta: any = row.metadata || {};
      const history = Array.isArray(report?.decisionHistory) ? report.decisionHistory : [];
      const active = [...history].reverse().find((decision: any) => decision.status === 'active') || null;
      const uplifted = [...history].reverse().find((decision: any) => ['uplifted', 'reverted'].includes(decision.status)) || null;
      let previous: any = null;
      let next: any = null;
      if (row.action === 'REPORT_DECIDED') {
        next = { finding: meta.finding || report?.finding || null, action: meta.action || report?.action || null };
        const prior = meta.previousFinding || meta.previousAction
          ? { finding: meta.previousFinding || null, action: meta.previousAction || null }
          : history.length > 1 ? history[history.length - 2] : null;
        previous = prior ? { finding: prior.finding || null, action: prior.action || null } : null;
        // A reputation downgrade records the new level on the decision and the
        // level it replaced, so Activity Logs can show both outcomes.
        if ((meta.action || report?.action) === 'reputation_downgrade') {
          next.level = meta.level || active?.level || null;
          if (previous) previous.level = active?.previousLevel || prior?.previousLevel || null;
        }
      } else if (row.action === 'ACTION_UPLIFTED' || row.action === 'APPEAL_UPHELD') {
        previous = meta.previousAction
          ? { finding: meta.previousFinding || null, action: meta.previousAction }
          : uplifted || active;
      } else if (row.action === 'APPEAL_DISCARDED') {
        previous = active;
        next = active;
      }
      const canUplift = row.action === 'REPORT_DECIDED'
        && !!report
        && report.queue === 'moderator'
        && report.status === 'resolved'
        && !report.uplifted
        && !!report.action
        && !['warning', 'no_action'].includes(String(report.action));
      return {
        id: row.id,
        action: row.action,
        actor: row.actor,
        createdAt: row.createdAt,
        details: row.details,
        reason: meta.reason || meta.conclusion || null,
        reportId: report?.id || row.reportId || null,
        code: report ? this.reportCode(report.id) : null,
        competitionId: report?.competitionId || meta.competitionId || null,
        competitionName: (report && competitionNames.get(report.competitionId)) || meta.competitionName || null,
        affectedUsername: meta.reportedUsername || report?.reportedUsername || null,
        previous,
        next,
        canUplift,
        report: report ? {
          id: report.id,
          code: this.reportCode(report.id),
          queue: report.queue,
          status: report.status,
          finding: report.finding,
          action: report.action,
          uplifted: report.uplifted,
          reporterUsername: report.reporterUsername,
          reportedUsername: report.reportedUsername,
          competitionId: report.competitionId,
          competitionName: competitionNames.get(report.competitionId) || null,
          reasonCode: report.reasonCode,
          priority: report.priority,
          description: report.description,
          createdAt: report.createdAt,
        } : null,
      };
    });

    const counts = {
      resolved: Number(rawCounts?.resolved || 0),
      discarded: Number(rawCounts?.discarded || 0),
      total: Number(rawCounts?.total || 0),
    };
    return {
      moderator: { username: account.username, role: account.role, email: account.email || null },
      counts,
      activities,
    };
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

    // The competition's full timeline (competition, its teams, anything tagged with it)
    // plus the organiser's reputation events.
    const [competitionEvents, reputationRows] = await Promise.all([
      this.competitionTimeline(report.competitionId, teams.map((t) => t.id)),
      this.auditRows.createQueryBuilder('a')
        .where('a."entityType" = :type AND a."entityId" = :organiser', { type: 'organiser_reputation', organiser })
        .orderBy('a."createdAt"', 'ASC').take(100).getMany(),
    ]);

    const timeline = [
      ...competitionEvents,
      ...reputationRows.map((row) => ({
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
        allSanctions: sanctionsCount.sanctions,
      },
      competition: comp,
      teams: teams.map((t) => ({ ...t, leaderUsername: t.leaderUsername || t.leaderId })),
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
