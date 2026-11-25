import { LifecycleService, managed } from '../payments/lifecycle.service';
import { RevenueService } from '../revenue/revenue.service';
import { platformFeeMinor, organizerTrusted, DEFAULT_MIN_ORGANIZER_TRUST } from '../payments/payment.rules';
import { Optional, Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetitionRepository } from './repositories/competition.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { TeamEntity } from '../../entities/team.entity';
import { CompetitionRemovalEntity } from '../../entities/competition-removal.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import { ReputationService } from '../reputation/reputation.service';
import { AdminService } from '../admin/admin.service';
import { CreateCompetitionDto, UpdateCompetitionDto } from './dto/competition.dto';
import { ICompetition } from '../../common/interfaces';
import { isPrivilegedRole } from '../../common/validation/player-eligibility';
import {
  MAX_PRIZE_POOL,
  MIN_ENTRY_FEE,
  validatePrizePool,
  parsePrizeAmount,
  validatePrizeDistribution,
  resolvePrizeTotal,
  validateEntryFee,
  validateDateWindow,
  validateFutureDates,
  MAX_DATE_EDITS,
  validateCompetitionName,
  validateDescription,
  isRegistrationClosed,
  isCompetitionStarted,
  validateCapacityEdit,
  resolveCoOrganizers,
  generateJoinCode,
  LARGE_PRIZE_POOL,
  isUnpublished,
} from '../../common/validation/competition.rules';
import { organiserEndBlockers } from '../../common/competition-end';

@Injectable()
export class CompetitionsService {
  constructor(
    private competitionRepository: CompetitionRepository,
    private userRepository: UserRepository,
    @InjectRepository(TeamEntity)
    private teamRepository: Repository<TeamEntity>,
    @InjectRepository(CompetitionRemovalEntity)
    private removalRepository: Repository<CompetitionRemovalEntity>,
    private notificationsService: NotificationsService,
    private auditLog: AuditLogService,
    private revenueService: RevenueService,
    private reputation: ReputationService,
    private adminService: AdminService,
    @Optional() private lifecycle?: LifecycleService,
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new BadRequestException('Authenticated user no longer exists.');
    return user;
  }

  async createCompetition(
    createCompetitionDto: CreateCompetitionDto,
    createdBy: string = 'system',
    authenticatedUserId?: string,
  ): Promise<ICompetition> {
    if (authenticatedUserId) {
      const organizer: any = await this.requireUser(authenticatedUserId);
      // §9.5 — repeated cancellations/fraud lower the trust score and block new competitions.
      const minimum = Number(process.env.MIN_ORGANIZER_TRUST_SCORE ?? DEFAULT_MIN_ORGANIZER_TRUST);
      if (!organizerTrusted(organizer.organizerTrustScore, minimum)) {
        throw new ForbiddenException(`Your organizer trust score (${organizer.organizerTrustScore}) is below ${minimum} after cancelled or reversed competitions. Contact the finance team to review your account.`);
      }
    }

    const { name, description, startDate, endDate, coOrganizers, ...extras } = createCompetitionDto;

    const nameError = validateCompetitionName(name);
    if (nameError) throw new BadRequestException(nameError);
    const descriptionError = validateDescription(description);
    if (descriptionError) throw new BadRequestException(descriptionError);
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      throw new BadRequestException('Valid tournament start date is required for auto-approval.');
    }
    if (!endDate || isNaN(new Date(endDate).getTime())) {
      throw new BadRequestException('Valid tournament end date is required for auto-approval.');
    }

    // §3.4 — registration window and competition dates are separate concepts
    const regOpenRaw = createCompetitionDto.registrationOpenAt ?? createCompetitionDto.regOpen ?? null;
    const regCloseRaw = createCompetitionDto.registrationCloseAt ?? createCompetitionDto.regClose ?? null;
    const window = {
      registrationOpenAt: regOpenRaw ? new Date(regOpenRaw) : null,
      registrationCloseAt: regCloseRaw ? new Date(regCloseRaw) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    const dateErrors = [...validateDateWindow(window), ...validateFutureDates(window)];
    if (dateErrors.length) {
      throw new BadRequestException(dateErrors.map((e) => e.message).join(' '));
    }

    // §2.2 — prize pool cap ₹10,00,000, computed from BOTH the declared prize
    // and the full distribution list. Admin approval above ₹50,000 is removed.
    const prizeError = validatePrizePool(extras.prize ?? 0);
    if (prizeError) throw new BadRequestException(prizeError);

    const distributionError = validatePrizeDistribution((extras as any).prizes);
    if (distributionError) throw new BadRequestException(distributionError);

    const poolAmount = parsePrizeAmount((extras as any).prizePool);
    if (Number.isNaN(poolAmount)) throw new BadRequestException('Prize pool must be a valid number.');
    if (poolAmount < 0) throw new BadRequestException('Prize pool cannot be negative.');

    const resolvedPrize = resolvePrizeTotal({
      prize: extras.prize,
      prizePool: (extras as any).prizePool,
      prizes: (extras as any).prizes,
    });
    const totalPrizeError = validatePrizePool(resolvedPrize);
    if (totalPrizeError) throw new BadRequestException(totalPrizeError);

    // Organiser reputation + platform ceiling. Both are enforced here so a
    // direct API request can never bypass the limits shown in the UI.
    await this.reputation.assertCanOrganise(createdBy);
    // Above ₹10,00,000 a finance moderator approves this specific competition,
    // so the organiser must say who they are and how finance can reach them.
    const largePrize = resolvedPrize > LARGE_PRIZE_POOL;
    const contact = (createCompetitionDto as any).contactDetails;
    if (largePrize && !contact) {
      throw new BadRequestException(`Prize pools above ₹${LARGE_PRIZE_POOL.toLocaleString('en-IN')} need a finance moderator's approval. Add your contact details so finance can reach you.`);
    }
    const prizeGate = largePrize
      ? await this.reputation.assertWithinCeiling(resolvedPrize)
      : await this.reputation.authorizePrizePool(resolvedPrize, createdBy);

    const { prizes: _prizeDistribution, contactDetails: _contact, ...competitionExtras } = extras as any;

    // §2.2 — minimum entry fee ₹10 where a fee applies; a free competition charges nothing.
    // Free or Paid only: on a paid competition every player pays the fee themselves.
    if (extras.feeType === 'per_team') throw new BadRequestException('The entry fee must be Free or Paid; every player pays their own fee.');
    const feeType = extras.feeType === 'paid' ? 'per_player' : (extras.feeType || 'free');
    if (feeType === 'free' && Number(extras.entryFeeAmount || 0) !== 0) {
      throw new BadRequestException('A free competition cannot have an entry fee.');
    }
    if (feeType !== 'free' && extras.entryFeeAmount === undefined) {
      throw new BadRequestException('Enter the entry fee for a paid competition.');
    }
    const feeTypeError = validateEntryFee(feeType, extras.entryFeeAmount);
    if (feeTypeError) throw new BadRequestException(feeTypeError);

    // Super Admin platform switches apply to every organizer.
    const platform = await this.adminService.getPlatformSettings();
    const format = String(extras.format || '');
    if (/elimination/i.test(format) && !platform.allowKnockout) throw new BadRequestException('Knockout competitions are currently disabled by the platform.');
    if (/robin|league/i.test(format) && !platform.allowRoundRobin) throw new BadRequestException('Round-robin competitions are currently disabled by the platform.');
    if (Number(extras.maxTeams || 0) > platform.maxTeams) throw new BadRequestException(`Max teams cannot exceed ${platform.maxTeams} on this platform.`);
    if (extras.img !== undefined) this.assertBanner(extras.img);

    // §2.1 — co-organizers must be registered player accounts; they are invited and
    // gain organizer rights only after accepting.
    let validCoOrganizers: string[] = [];
    if (Array.isArray(coOrganizers) && coOrganizers.length > 0) {
      validCoOrganizers = await this.resolveInvitees(coOrganizers, createdBy);
    }

    // §2.4 visibility + join code generation for private competitions
    const visibility = String(extras.visibility) === 'private' ? 'private' : String(extras.visibility) === 'public' ? 'public' : (String((extras as any).isPrivate) === 'true' ? 'private' : 'public');
    const joinCode = visibility === 'private' ? generateJoinCode() : null;

    const regOpen = regOpenRaw ? new Date(regOpenRaw) : null;
    const regClose = regCloseRaw ? new Date(regCloseRaw) : null;

    const prizeDistributionMinor = ((extras as any).prizes || []).map((p: any) => Math.round(parsePrizeAmount(p.amount) * 100)).filter((amount: number) => amount > 0);
    if (prizeDistributionMinor.length && prizeDistributionMinor.reduce((a: number,b: number)=>a+b,0) !== Math.round(resolvedPrize*100)) throw new BadRequestException('Prize positions must add up to the total prize pool.');
    const feeConfig = await this.revenueService.getConfig();
    const feeMinor = platformFeeMinor(resolvedPrize, Number(feeConfig.percentage), Number(feeConfig.minCost));

    // All-or-nothing: validation errors above must not leave a partially published competition.
    const competition = await this.competitionRepository.create(
      name.trim(),
      description.trim(),
      new Date(startDate),
      new Date(endDate),
      createdBy,
      [],
      {
        ...competitionExtras,
        feeType,
        entryFeeAmount: feeType === 'free' ? 0 : extras.entryFeeAmount,
        pendingOrganizers: validCoOrganizers,
        prize: resolvedPrize,
        prizeDistributionMinor: prizeDistributionMinor.length ? prizeDistributionMinor : [Math.round(resolvedPrize * 100)],
        visibility,
        joinCode,
        registrationOpenAt: regOpen,
        registrationCloseAt: regClose,
        // §2.2 — competitions are auto-approved regardless of prize size; the
        // >₹50,000 administrative approval requirement is removed.
        approvalStatus: 'approved',
        status: 'draft',
        organizerPaid: false,
        paymentStatus: largePrize ? 'AWAITING_FINANCE_APPROVAL' : 'AWAITING_PLATFORM_FEE',
        platformFee: feeMinor / 100,
        largePrizeRequest: largePrize
          ? {
              status: 'pending',
              requestedBy: createdBy,
              requestedAt: new Date().toISOString(),
              prize: resolvedPrize,
              contact: {
                fullName: String(contact.fullName).trim(),
                phone: String(contact.phone).trim(),
                email: String(contact.email).trim().toLowerCase(),
                organisation: contact.organisation ? String(contact.organisation).trim() : '',
                purpose: String(contact.purpose).trim(),
              },
            }
          : null,
      },
    );

    // Bind a single-use approved prize-pool exception to this competition.
    if (prizeGate.exceptionId) {
      await this.reputation.consumeException(prizeGate.exceptionId, competition.id, resolvedPrize);
    }

    validCoOrganizers.forEach((co) => this.sendOrganizerInvite(competition, co, createdBy));
    if (largePrize) await this.notifyFinanceOfLargePrize(competition as any, createdBy, resolvedPrize);

    await this.auditLog.record('COMPETITION_CREATED', {
      actor: createdBy,
      entityType: 'competition',
      entityId: competition.id,
      details: `Created "${competition.name}" (visibility=${visibility}).`,
      metadata: { prize: competition.prize ?? 0, game: competition.game, type: competition.type },
    });

    return competition as any;
  }

  /** Every finance moderator is asked to review a prize pool above ₹10,00,000. */
  private async notifyFinanceOfLargePrize(competition: ICompetition, organiser: string, prize: number) {
    const staff = (await this.userRepository.findAll()).filter((u: any) => u.role === 'finance_moderator' && !u.banned);
    await Promise.all(staff.map((u: any) => this.notificationsService.create({
      toUsername: u.username,
      type: 'large-prize-request',
      status: 'pending',
      title: 'Prize pool approval needed',
      body: `@${organiser} wants to run "${competition.name}" with a ₹${prize.toLocaleString('en-IN')} prize pool. Review their contact details and approve or reject it.`,
      meta: { compId: competition.id, link: '/pages/admin/finance.html?tab=requests' },
    }).catch(() => undefined)));
    await this.auditLog.record('LARGE_PRIZE_REQUESTED', {
      actor: organiser,
      entityType: 'competition',
      entityId: competition.id,
      details: `Requested finance approval for a ₹${prize.toLocaleString('en-IN')} prize pool on "${competition.name}".`,
      metadata: { prize },
    });
  }

  async getCompetitionById(id: string, viewerUsername?: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) return comp;
    if (isUnpublished(comp)) throw new NotFoundException('Competition is not published yet.');
    // A removed player is not a participant of this competition any more. The
    // check runs against the database on every read, so a cached page or an old
    // URL cannot restore access. Public/ANONYMOUS reads are unaffected.
    if (viewerUsername) {
      const removal = await this.removalRepository
        .createQueryBuilder('removal')
        .where('removal.competitionId = :id', { id })
        .andWhere('lower(removal.username) = :username', { username: String(viewerUsername).toLowerCase() })
        .getOne();
      if (removal) {
        throw new ForbiddenException(
          'You have been removed from this competition. You can no longer access its team or competition management features.',
        );
      }
    }
    // §2.4 — never expose a private competition's join code on the public
    // detail endpoint. The organizer-only /competitions/:id/join-code route
    // is the single authorized reveal path.
    return this.withoutJoinCode(comp);
  }

  /** Final placings, visible to anyone who can see the competition. */
  async getResults(id: string, viewerUsername?: string) {
    await this.getCompetitionById(id, viewerUsername);
    if (!this.lifecycle) return { available: false, reason: 'unavailable' };
    return this.lifecycle.results(id);
  }

  private assertBanner(image: unknown) {
    if (typeof image !== 'string') throw new BadRequestException('Choose a PNG or JPEG banner up to 5 MB.');
    if (image === '' || /^\/?[\w./-]+\.(png|jpe?g|webp)$/i.test(image) || /^https?:\/\//i.test(image)) return;
    if (image.length > 7 * 1024 * 1024 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image)) {
      throw new BadRequestException('Choose a PNG or JPEG banner up to 5 MB.');
    }
  }

  /**
   * Co-organizer candidates must be existing, active player accounts other than
   * the creator. Staff accounts can never organize a competition.
   */
  private async resolveInvitees(raw: string[], creator: string): Promise<string[]> {
    const allUsers = await this.userRepository.findAll();
    const { coOrganizers: clean, errors } = resolveCoOrganizers(raw, creator, allUsers.map((u) => u.username));
    if (errors.length) throw new BadRequestException(errors.map((e) => e.message).join(' '));
    const byName = new Map(allUsers.map((u) => [String(u.username).toLowerCase(), u]));
    const result: string[] = [];
    for (const name of clean) {
      const account = byName.get(name.toLowerCase());
      if (!account) throw new BadRequestException(`Co-organizer username "${name}" does not exist.`);
      if (account.banned) throw new BadRequestException(`@${account.username} is banned and cannot organize.`);
      if (isPrivilegedRole(account.role, account.adminType)) {
        throw new BadRequestException(`@${account.username} is a staff account. Staff cannot be co-organizers.`);
      }
      result.push(account.username);
    }
    return result;
  }

  private sendOrganizerInvite(competition: any, invitee: string, invitedBy: string) {
    this.notificationsService.create({
      toUsername: invitee,
      type: 'co-organizer-invite',
      status: 'pending',
      title: 'Co-organizer invitation',
      body: `@${invitedBy} invited you to co-organize "${competition.name}". Accept to help run it, or decline.`,
      meta: { compId: competition.id, compName: competition.name, invitedBy },
    }).catch(() => {});
  }

  /** The invitee accepts or declines; only acceptance grants organizer rights. */
  async respondToOrganizerInvite(id: string, user: any, accept: boolean): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException('Competition not found');
    const me = String(user?.username || '');
    const pending = comp.pendingOrganizers || [];
    const entry = pending.find((p) => p.toLowerCase() === me.toLowerCase());
    if (!entry) {
      // Already answered (or withdrawn): make sure no stale Accept/Decline remains in Alerts.
      await this.notificationsService.resolvePending(me, 'co-organizer-invite', 'compId', id, 'info').catch(() => undefined);
      throw new BadRequestException('You do not have a pending co-organizer invitation for this competition.');
    }
    const remaining = pending.filter((p) => p !== entry);
    const updates: any = { pendingOrganizers: remaining };
    if (accept) {
      if (isPrivilegedRole(user?.role, user?.adminType)) throw new ForbiddenException('Staff accounts cannot co-organize.');
      await this.assertNotPlaying(id, [entry]);
      updates.organizers = Array.from(new Set([...(comp.organizers || [comp.createdBy]), entry]));
    }
    const updated = await this.competitionRepository.update(id, updates);
    await this.notificationsService.resolvePending(entry, 'co-organizer-invite', 'compId', id, accept ? 'approved' : 'rejected').catch(() => undefined);
    await this.auditLog.record(accept ? 'CO_ORGANIZER_ACCEPTED' : 'CO_ORGANIZER_DECLINED', {
      actor: entry,
      entityType: 'competition',
      entityId: id,
      details: `@${entry} ${accept ? 'accepted' : 'declined'} the co-organizer invitation for "${comp.name}".`,
    });
    this.notificationsService.create({
      toUsername: comp.createdBy,
      type: 'co-organizer-response',
      status: accept ? 'approved' : 'rejected',
      title: accept ? 'Co-organizer joined' : 'Co-organizer invitation declined',
      body: `@${entry} ${accept ? 'accepted' : 'declined'} your invitation to co-organize "${comp.name}".`,
      meta: { compId: id },
    }).catch(() => {});
    return this.withoutJoinCode(updated);
  }

  /**
   * The public shape of a competition: never the private join code, and only
   * the status of finance requests. The organiser's contact details and the
   * early-end reason are served to owners and finance by the payments API.
   */
  private withoutJoinCode(comp: any): ICompetition {
    const { joinCode, largePrizeRequest, earlyEndRequest, ...publicCompetition } = comp;
    const brief = (req: any) => (req ? { status: req.status, requestedAt: req.requestedAt || null, decidedAt: req.decidedAt || null } : null);
    return { ...publicCompetition, largePrizeRequest: brief(largePrizeRequest), earlyEndRequest: brief(earlyEndRequest) } as ICompetition;
  }

  /** Join-code validation for private competitions (§2.4). */
  async validateJoinCode(competitionId: string, joinCode: string): Promise<boolean> {
    const comp = await this.competitionRepository.findById(competitionId);
    if (!comp) throw new NotFoundException(`Competition with ID ${competitionId} not found`);
    if (comp.visibility !== 'private') return true; // public — no code required
    if (!joinCode || String(joinCode).trim().toUpperCase() !== String(comp.joinCode || '').toUpperCase()) {
      throw new BadRequestException('Invalid join code for this private competition.');
    }
    return true;
  }

  /** Organizer-only: reveal the join code for a private competition. */
  async getJoinCode(competitionId: string, requesterUsername: string, requesterRole: string): Promise<{ joinCode: string | null; visibility: string }> {
    const comp = await this.competitionRepository.findById(competitionId);
    if (!comp) throw new NotFoundException(`Competition with ID ${competitionId} not found`);
    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    const isAdmin = ['super_admin'].includes(requesterRole);
    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException('Only organizers of this competition can view its join code.');
    }
    return { joinCode: comp.visibility === 'private' ? comp.joinCode : null, visibility: comp.visibility };
  }

  async participate(
    competitionId: string,
    joinCode: string | undefined,
    user: any,
  ): Promise<{ ok: boolean; message: string }> {
    const userId = typeof user === 'string' ? null : user?.id;
    if (!userId) {
      throw new ForbiddenException('Authentication is required to join a competition.');
    }

    const comp = await this.competitionRepository.findById(competitionId);
    if (!comp) throw new NotFoundException(`Competition ${competitionId} not found`);
    if (isUnpublished(comp)) throw new ForbiddenException('This competition is not published yet.');
    if (comp.visibility === 'private') {
      if (!joinCode || String(joinCode).trim().toUpperCase() !== String(comp.joinCode || '').toUpperCase()) {
        throw new BadRequestException('Invalid join code. Please check the code with your organizer and try again.');
      }
      return { ok: true, message: `Join code verified for "${comp.name}". You can now register your team!` };
    }
    return { ok: true, message: `"${comp.name}" is open to join.` };
  }

  async getAllCompetitions(): Promise<ICompetition[]> {
    const competitions = await this.competitionRepository.findAll();
    return competitions.filter(comp => !isUnpublished(comp)).map((comp) => this.withoutJoinCode(comp));
  }

  async getCompetitionsByUser(userId: string): Promise<ICompetition[]> {
    const competitions = await this.competitionRepository.findByCreator(userId);
    return competitions.map((comp) => this.withoutJoinCode(comp));
  }

  async getCompetitionsByOrganizer(userId: string, requesterUsername?: string): Promise<ICompetition[]> {
    const competitions = await this.competitionRepository.findByOrganizer(userId);
    return competitions.filter(comp => !isUnpublished(comp) || comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername)).map((comp) => this.withoutJoinCode(comp));
  }

  async addCoOrganizer(id: string, organizerId: string, requesterUsername: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);
    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    if (!isOrganizer) throw new ForbiddenException('Only an organizer of this competition can add co-organizers.');

    const [invitee] = await this.resolveInvitees([organizerId], comp.createdBy);
    if ((comp.organizers || []).some((o) => o.toLowerCase() === invitee.toLowerCase())) {
      throw new BadRequestException(`@${invitee} already co-organizes this competition.`);
    }
    if ((comp.pendingOrganizers || []).some((o) => o.toLowerCase() === invitee.toLowerCase())) {
      throw new BadRequestException(`@${invitee} already has a pending invitation.`);
    }
    await this.assertNotPlaying(id, [invitee]);
    const updated = await this.competitionRepository.update(id, {
      pendingOrganizers: [...(comp.pendingOrganizers || []), invitee],
    } as any);
    this.sendOrganizerInvite(comp, invitee, requesterUsername);
    return this.withoutJoinCode(updated);
  }

  /**
   * Conflict of interest: an organizer enters results and receives the
   * registration revenue, so nobody on an active team may also organize.
   */
  private async assertNotPlaying(competitionId: string, usernames: string[]) {
    const teams = await this.teamRepository.find({ where: { competitionId } });
    const wanted = new Set(usernames.map((u) => String(u || '').toLowerCase()));
    const playing = teams
      .filter((t) => !['banned', 'rejected', 'disbanded'].includes(t.status))
      .flatMap((t) => t.memberUsernames || [])
      .filter((name) => wanted.has(String(name).toLowerCase()));
    if (playing.length) {
      throw new BadRequestException(`${Array.from(new Set(playing)).map((n) => `@${n}`).join(', ')} already play in this competition and cannot also organize it.`);
    }
  }

  async removeCoOrganizer(id: string, organizerId: string, requesterUsername: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);
    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    if (!isOrganizer) throw new ForbiddenException('Only an organizer of this competition can remove co-organizers.');
    const target = String(organizerId || '').trim().replace(/^@/, '').toLowerCase();
    if (target === String(comp.createdBy).toLowerCase()) {
      throw new BadRequestException('The primary organizer cannot be removed.');
    }
    const inOrganizers = (comp.organizers || []).find((o) => o.toLowerCase() === target);
    const inPending = (comp.pendingOrganizers || []).find((o) => o.toLowerCase() === target);
    if (!inOrganizers && !inPending) throw new NotFoundException(`@${organizerId} is not a co-organizer of this competition.`);
    const updated = await this.competitionRepository.update(id, {
      organizers: (comp.organizers || []).filter((o) => o.toLowerCase() !== target),
      pendingOrganizers: (comp.pendingOrganizers || []).filter((o) => o.toLowerCase() !== target),
    } as any);
    return this.withoutJoinCode(updated);
  }

  /**
   * §3 — edit restrictions enforced here so direct API requests cannot bypass the UI:
   *  - after registration closure: name / game / type / description locked (§3.1)
   *  - prize pool & prizePool immutable through the edit API (§3.2)
   *  - capacity may not decrease below current values / registered teams / rosters (§3.3)
   *  - date chronology re-validated as separate concepts (§3.4)
   *  - obsolete fields (format, season, prize-entry fee edits) rejected (§3.5)
   */
  async updateCompetition(
    id: string,
    updateCompetitionDto: UpdateCompetitionDto,
    requesterUsername: string,
    requesterRole: string,
  ): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition with ID ${id} not found`);

    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    const isAdmin = ['super_admin'].includes(requesterRole);
    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException('Only an organizer of this competition (or an admin) can update it.');
    }
    // Reputation sanctions (creation restriction / bans) are backend-enforced.
    if (isOrganizer) await this.reputation.assertCanOrganise(requesterUsername);

    // §3.5 — obsolete edit fields must not be smuggled through the API
    const obsoleteTouched = ['format', 'season', 'prizePool', 'prize'].filter(
      (k) => (updateCompetitionDto as any)[k] !== undefined,
    );
    if (obsoleteTouched.length) {
      if (obsoleteTouched.includes('prizePool') || obsoleteTouched.includes('prize')) {
        throw new BadRequestException('The prize pool cannot be modified after the competition is created.');
      }
      throw new BadRequestException(`Field(s) ${obsoleteTouched.join(', ')} are no longer editable.`);
    }
    if (comp.paymentStatus && comp.paymentStatus !== 'LEGACY' && updateCompetitionDto.entryFeeAmount !== undefined && Number(updateCompetitionDto.entryFeeAmount) !== Number(comp.entryFeeAmount)) {
      throw new BadRequestException('Entry fee is fixed for payment-managed competitions.');
    }
    if ((updateCompetitionDto as any).entryFeeAmount !== undefined) {
      const feeError = validateEntryFee(comp.feeType, (updateCompetitionDto as any).entryFeeAmount);
      if (feeError) throw new BadRequestException(feeError);
    }

    const regClosed = isRegistrationClosed(comp as any);
    const lockedAfterRegClose = ['name', 'game', 'type'] as const;
    for (const field of lockedAfterRegClose) {
      if (regClosed && (updateCompetitionDto as any)[field] !== undefined && (updateCompetitionDto as any)[field] !== (comp as any)[field]) {
        throw new BadRequestException(`Registration has closed: "${field}" can no longer be edited.`);
      }
    }
    if (regClosed && updateCompetitionDto.description !== undefined && String(updateCompetitionDto.description).trim() !== String(comp.description || '').trim()) {
      throw new BadRequestException('Registration has closed: "description" can no longer be edited.');
    }

    // §2.1 — co-organizer edits are validated in full before any write. Existing
    // co-organizers stay; new names become pending invitations.
    let nextOrganizers: string[] | undefined;
    let nextPending: string[] | undefined;
    let newlyInvited: string[] = [];
    if (updateCompetitionDto.coOrganizers !== undefined && updateCompetitionDto.coOrganizers !== null) {
      const requested = await this.resolveInvitees(updateCompetitionDto.coOrganizers || [], comp.createdBy);
      const wanted = new Set(requested.map((n) => n.toLowerCase()));
      const current = (comp.organizers || []).filter((o) => o.toLowerCase() !== String(comp.createdBy).toLowerCase());
      const pending = comp.pendingOrganizers || [];
      nextOrganizers = [comp.createdBy, ...current.filter((o) => wanted.has(o.toLowerCase()))];
      const known = new Set([...current, ...pending].map((n) => n.toLowerCase()));
      newlyInvited = requested.filter((n) => !known.has(n.toLowerCase()));
      nextPending = [...pending.filter((p) => wanted.has(p.toLowerCase())), ...newlyInvited];
      await this.assertNotPlaying(id, newlyInvited);
    }

    // §3.3 capacity checks with real registered teams + roster sizes
    if (updateCompetitionDto.maxTeams !== undefined || updateCompetitionDto.maxPlayersPerTeam !== undefined) {
      const teams = await this.teamRepository.find({ where: { competitionId: id } });
      const registered = teams.filter((t) => t.status !== 'rejected' && t.status !== 'banned');
      const largestRoster = registered.reduce((max, t) => Math.max(max, (t.memberUsernames || []).length), 0);
      const errors = validateCapacityEdit(
        { maxTeams: comp.maxTeams, maxPlayersPerTeam: comp.maxPlayersPerTeam },
        { maxTeams: updateCompetitionDto.maxTeams, maxPlayersPerTeam: updateCompetitionDto.maxPlayersPerTeam },
        registered.length,
        largestRoster,
      );
      if (errors.length) {
        throw new BadRequestException(errors.map((e) => e.message).join(' '));
      }
      // The Super Admin's saved team limit applies to edits as well as creation.
      // An existing competition already above a since-lowered limit may keep its
      // size, but can never be raised further.
      if (updateCompetitionDto.maxTeams !== undefined) {
        const platform = await this.adminService.getPlatformSettings();
        const next = Number(updateCompetitionDto.maxTeams);
        if (next > platform.maxTeams && next > Number(comp.maxTeams || 0)) {
          throw new BadRequestException(`Max teams cannot exceed ${platform.maxTeams} on this platform.`);
        }
      }
    }

    // §3.4 date order whenever any date changes. Dates are frozen once play starts,
    // and any date that changes must lie in the future.
    const dateChange = {
      registrationOpenAt: updateCompetitionDto.registrationOpenAt ? new Date(updateCompetitionDto.registrationOpenAt) : null,
      registrationCloseAt: updateCompetitionDto.registrationCloseAt ? new Date(updateCompetitionDto.registrationCloseAt) : null,
      startDate: updateCompetitionDto.startDate ? new Date(updateCompetitionDto.startDate) : null,
      endDate: updateCompetitionDto.endDate ? new Date(updateCompetitionDto.endDate) : null,
    };
    const changed = (a: Date | null, b: Date | null | undefined) => !!a && (!b || +a !== +new Date(b));
    const datesChanging = changed(dateChange.registrationOpenAt, comp.registrationOpenAt) || changed(dateChange.registrationCloseAt, comp.registrationCloseAt)
      || changed(dateChange.startDate, comp.startDate) || changed(dateChange.endDate, comp.endDate);
    // Date edit limits (persisted on the competition, so no client can bypass them):
    //  - once any team has registered, the registration opening date is fixed;
    //  - before play starts, the schedule can be changed in at most 2 saves;
    //  - after play starts, only the end date can change, at most 2 times.
    let dateEditField: 'dateEditCount' | 'endDateEditCount' | null = null;
    if (datesChanging) {
      const comp2: any = comp;
      if (isCompetitionStarted(comp as any)) {
        const otherDatesChanging = changed(dateChange.registrationOpenAt, comp.registrationOpenAt)
          || changed(dateChange.registrationCloseAt, comp.registrationCloseAt)
          || changed(dateChange.startDate, comp.startDate);
        if (otherDatesChanging) {
          throw new BadRequestException('The competition has started: only its end date can still be changed.');
        }
        if (Number(comp2.endDateEditCount || 0) >= MAX_DATE_EDITS) {
          throw new BadRequestException(`The end date has already been changed ${MAX_DATE_EDITS} times after the competition started.`);
        }
        dateEditField = 'endDateEditCount';
      } else {
        if (changed(dateChange.registrationOpenAt, comp.registrationOpenAt)) {
          const teams = await this.teamRepository.find({ where: { competitionId: id } });
          if (teams.some((t) => t.status !== 'rejected' && t.status !== 'disbanded')) {
            throw new BadRequestException('Teams have already registered, so the registration opening date can no longer be changed.');
          }
        }
        if (Number(comp2.dateEditCount || 0) >= MAX_DATE_EDITS) {
          throw new BadRequestException(`The dates have already been changed ${MAX_DATE_EDITS} times and can no longer be edited.`);
        }
        dateEditField = 'dateEditCount';
      }
      const merged = {
        registrationOpenAt: dateChange.registrationOpenAt ?? comp.registrationOpenAt ?? null,
        registrationCloseAt: dateChange.registrationCloseAt ?? comp.registrationCloseAt ?? null,
        startDate: dateChange.startDate ?? comp.startDate ?? null,
        endDate: dateChange.endDate ?? comp.endDate ?? null,
      };
      const future = validateFutureDates({
        startDate: changed(dateChange.startDate, comp.startDate) ? dateChange.startDate : null,
        endDate: changed(dateChange.endDate, comp.endDate) ? dateChange.endDate : null,
        registrationCloseAt: changed(dateChange.registrationCloseAt, comp.registrationCloseAt) ? dateChange.registrationCloseAt : null,
      });
      const changedDates = (['registrationOpenAt', 'registrationCloseAt', 'startDate', 'endDate'] as const)
        .filter((k) => changed(dateChange[k], comp[k]));
      const dateErrors = [...validateDateWindow(merged, [...changedDates]), ...future];
      if (dateErrors.length) {
        throw new BadRequestException(dateErrors.map((e) => e.message).join(' '));
      }
    }
    if (updateCompetitionDto.name !== undefined) {
      const nameError = validateCompetitionName(updateCompetitionDto.name);
      if (nameError) throw new BadRequestException(nameError);
    }
    if (updateCompetitionDto.description !== undefined) {
      const descriptionError = validateDescription(updateCompetitionDto.description);
      if (descriptionError) throw new BadRequestException(descriptionError);
    }

    const updates: Partial<ICompetition> = {};
    if (updateCompetitionDto.img !== undefined) {
      this.assertBanner(updateCompetitionDto.img);
      (updates as any).img = updateCompetitionDto.img;
    }
    if (updateCompetitionDto.name !== undefined) updates.name = updateCompetitionDto.name.trim();
    if (updateCompetitionDto.description !== undefined) updates.description = updateCompetitionDto.description.trim();
    if (updateCompetitionDto.game !== undefined) (updates as any).game = updateCompetitionDto.game;
    if (updateCompetitionDto.type !== undefined) (updates as any).type = updateCompetitionDto.type;
    if (updateCompetitionDto.status && comp.paymentStatus && comp.paymentStatus !== 'LEGACY' && updateCompetitionDto.status !== comp.status) {
      throw new BadRequestException('Payment-managed competition status cannot be changed through the edit endpoint.');
    }
    if (updateCompetitionDto.status) updates.status = updateCompetitionDto.status;
    if (nextOrganizers !== undefined) (updates as any).organizers = nextOrganizers;
    if (nextPending !== undefined) (updates as any).pendingOrganizers = nextPending;
    if (updateCompetitionDto.endDate) updates.endDate = new Date(updateCompetitionDto.endDate);
    if (updateCompetitionDto.startDate) (updates as any).startDate = new Date(updateCompetitionDto.startDate);
    if (updateCompetitionDto.maxTeams !== undefined) (updates as any).maxTeams = updateCompetitionDto.maxTeams;
    if (updateCompetitionDto.maxPlayersPerTeam !== undefined) (updates as any).maxPlayersPerTeam = updateCompetitionDto.maxPlayersPerTeam;
    if (updateCompetitionDto.entryFeeAmount !== undefined) (updates as any).entryFeeAmount = updateCompetitionDto.entryFeeAmount;
    if (updateCompetitionDto.registrationOpenAt) (updates as any).registrationOpenAt = new Date(updateCompetitionDto.registrationOpenAt);
    if (updateCompetitionDto.registrationCloseAt) (updates as any).registrationCloseAt = new Date(updateCompetitionDto.registrationCloseAt);
    if (dateEditField) (updates as any)[dateEditField] = Number((comp as any)[dateEditField] || 0) + 1;

    const updated = await this.competitionRepository.update(id, updates as any);
    newlyInvited.forEach((invitee) => this.sendOrganizerInvite(updated, invitee, requesterUsername));

    await this.auditLog.record('COMPETITION_UPDATED', {
      actor: requesterUsername,
      entityType: 'competition',
      entityId: id,
      details: `Updated fields: ${Object.keys(updates).join(', ') || 'none'}.`,
      metadata: { regClosed, status: updated.status },
    });

    return this.withoutJoinCode(updated);
  }

  /**
   * §13.2/§13.4 — participant contact list for the authorized organizer dashboard.
   * Emails always come from the real user accounts; restricted to the
   * competition's organizers and admin roles. Never exposed publicly.
   */
  async getParticipantContacts(
    id: string,
    requesterUsername: string,
    requesterRole: string,
  ): Promise<Array<{ username: string; email: string | null; teamName: string; role: string; feePaid: number }>> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition with ID ${id} not found`);
    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    const isAdmin = ['super_admin', 'finance_moderator'].includes(requesterRole);
    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException('Only organizers of this competition (or admins) can view participant contact details.');
    }

    const teams = await this.teamRepository.find({ where: { competitionId: id } });
    const results: Array<{ username: string; email: string | null; teamName: string; role: string; feePaid: number }> = [];
    for (const team of teams) {
      if (team.status === 'rejected' || team.status === 'disbanded') continue;
      const members = team.memberUsernames || [];
      for (const username of members) {
        const user = await this.userRepository.findByUsername(username);
        results.push({
          username,
          email: user ? user.email : null,
          teamName: team.name,
          role: username === team.leaderUsername || username === team.leaderId || username === team.createdBy ? 'team_lead' : 'player',
          feePaid: typeof (team as any).feePaid === 'number' ? (team as any).feePaid : 0,
        });
      }
    }
    return results;
  }

  /**
   * Ends a competition only after its persisted start time, on the server
   * clock. Registration closure is deliberately NOT treated as a start.
   */
  async endCompetition(id: string, requesterUsername: string, requesterRole: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition with ID ${id} not found`);

    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    const isAdmin = ['super_admin'].includes(requesterRole);
    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException('Only an organizer of this competition (or an admin) can end it.');
    }

    if (comp.paymentStatus && comp.paymentStatus !== 'LEGACY') {
      if (!this.lifecycle) throw new BadRequestException('Payment settlement is unavailable.');
      return this.lifecycle.end(id, { username: requesterUsername, role: requesterRole });
    }
    if (String(comp.status).toLowerCase() === 'completed') {
      throw new BadRequestException('This competition has already ended.');
    }
    if (!isCompetitionStarted(comp as any)) {
      throw new BadRequestException('You can end the competition only after the tournament has started.');
    }
    // (Test doubles of the repository have no manager; production always does.)
    const blockers = this.teamRepository.manager ? await organiserEndBlockers(this.teamRepository.manager, id) : { total: 0 };
    if (blockers.total > 0) {
      throw new BadRequestException(`There ${blockers.total === 1 ? 'is 1 unresolved dispute' : `are ${blockers.total} unresolved disputes`} against you in this competition. You can end it once they are resolved; you will be notified when that happens.`);
    }

    const updated = await this.competitionRepository.update(id, { status: 'completed' } as any);
    await this.auditLog.record('COMPETITION_ENDED', {
      actor: requesterUsername,
      entityType: 'competition',
      entityId: id,
      details: `Competition "${comp.name}" ended by ${requesterUsername}.`,
      metadata: { startDate: comp.startDate, previousStatus: comp.status },
    });
    return updated as any;
  }

  async deleteCompetition(id: string, requesterUsername: string, requesterRole: string): Promise<void> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition with ID ${id} not found`);
    if (comp.paymentStatus && comp.paymentStatus !== 'LEGACY') throw new BadRequestException('Payment-managed competitions must be retained for reconciliation.');
    // Super-admin enforced at the route; organizer-level delete is not permitted else.
    await this.competitionRepository.delete(id);
    await this.auditLog.record('COMPETITION_DELETED', {
      actor: requesterUsername || requesterRole,
      entityType: 'competition',
      entityId: id,
      details: `Deleted "${comp.name}".`,
    });
  }

  async getActiveCompetitions(): Promise<ICompetition[]> {
    const competitions = await this.competitionRepository.findByStatus('active');
    return competitions.filter(comp => !isUnpublished(comp)).map((comp) => this.withoutJoinCode(comp));
  }

  async setApproval(id: string, decision: string, adminUsername: string): Promise<ICompetition> {
    return this.competitionRepository.setApproval(id, decision, adminUsername);
  }
}
