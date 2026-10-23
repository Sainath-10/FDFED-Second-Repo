import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetitionRepository } from './repositories/competition.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { TeamEntity } from '../../entities/team.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import { CreateCompetitionDto, UpdateCompetitionDto } from './dto/competition.dto';
import { ICompetition } from '../../common/interfaces';
import {
  MAX_PRIZE_POOL,
  MIN_ENTRY_FEE,
  validatePrizePool,
  validateEntryFee,
  validateDateWindow,
  isRegistrationClosed,
  validateCapacityEdit,
  resolveCoOrganizers,
  generateJoinCode,
} from '../../common/validation/competition.rules';

@Injectable()
export class CompetitionsService {
  constructor(
    private competitionRepository: CompetitionRepository,
    private userRepository: UserRepository,
    @InjectRepository(TeamEntity)
    private teamRepository: Repository<TeamEntity>,
    private notificationsService: NotificationsService,
    private auditLog: AuditLogService,
  ) {}

  /** Mock-verification gate (§12.4). Backend enforcement — frontend UI alone is insufficient. */
  private async assertVerified(userId: string, context: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new BadRequestException('Authenticated user no longer exists.');
    if (String(user.verificationStatus || '').toLowerCase() !== 'verified') {
      throw new ForbiddenException(
        `Simulated Aadhaar verification is required before you can ${context}. Open your Profile → Verification to complete the (simulated) verification flow.`,
      );
    }
    return user;
  }

  async createCompetition(
    createCompetitionDto: CreateCompetitionDto,
    createdBy: string = 'system',
    authenticatedUserId?: string,
  ): Promise<ICompetition> {
    // §12.4 verification gate — enforced on the backend
    if (authenticatedUserId) await this.assertVerified(authenticatedUserId, 'create or publish a competition');

    const { name, description, startDate, endDate, coOrganizers, ...extras } = createCompetitionDto;

    if (!name || name.trim().length < 3) {
      throw new BadRequestException('Tournament name must be at least 3 characters.');
    }
    if (!description || description.trim().length < 10) {
      throw new BadRequestException('Tournament description must be at least 10 characters.');
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      throw new BadRequestException('Valid tournament start date is required for auto-approval.');
    }
    if (!endDate || isNaN(new Date(endDate).getTime())) {
      throw new BadRequestException('Valid tournament end date is required for auto-approval.');
    }

    // §3.4 — registration window and competition dates are separate concepts
    const regOpenRaw = createCompetitionDto.registrationOpenAt ?? createCompetitionDto.regOpen ?? null;
    const regCloseRaw = createCompetitionDto.registrationCloseAt ?? createCompetitionDto.regClose ?? null;
    const dateErrors = validateDateWindow({
      registrationOpenAt: regOpenRaw ? new Date(regOpenRaw) : null,
      registrationCloseAt: regCloseRaw ? new Date(regCloseRaw) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    if (dateErrors.length) {
      throw new BadRequestException(dateErrors.map((e) => e.message).join(' '));
    }

    // §2.2 — prize pool cap ₹10,00,000; admin approval above ₹50,000 no longer required
    const prizeError = validatePrizePool(extras.prize ?? 0);
    if (prizeError) throw new BadRequestException(prizeError);

    // §2.2 — minimum entry fee ₹10 where a fee applies
    const feeTypeError = validateEntryFee(extras.feeType, extras.entryFeeAmount);
    if (feeTypeError) throw new BadRequestException(feeTypeError);

    // §2.1 — co-organizers must be registered usernames; no self-assignment; no duplicates
    let validCoOrganizers: string[] = [];
    if (Array.isArray(coOrganizers) && coOrganizers.length > 0) {
      const allUsers = await this.userRepository.findAll();
      const { coOrganizers: clean, errors } = resolveCoOrganizers(
        coOrganizers,
        createdBy,
        allUsers.map((u) => u.username),
      );
      if (errors.length) {
        throw new BadRequestException(errors.map((e) => e.message).join(' '));
      }
      validCoOrganizers = clean;
    }

    // §2.4 visibility + join code generation for private competitions
    const visibility = String(extras.visibility) === 'private' ? 'private' : String(extras.visibility) === 'public' ? 'public' : (String((extras as any).isPrivate) === 'true' ? 'private' : 'public');
    const joinCode = visibility === 'private' ? generateJoinCode() : null;

    const regOpen = regOpenRaw ? new Date(regOpenRaw) : null;
    const regClose = regCloseRaw ? new Date(regCloseRaw) : null;

    // All-or-nothing: validation errors above must not leave a partially published competition.
    const competition = await this.competitionRepository.create(
      name.trim(),
      description.trim(),
      new Date(startDate),
      new Date(endDate),
      createdBy,
      validCoOrganizers,
      {
        ...(extras as any),
        visibility,
        joinCode,
        registrationOpenAt: regOpen,
        registrationCloseAt: regClose,
        // §2.2 — competitions are auto-approved regardless of prize size; the
        // >₹50,000 administrative approval requirement is removed.
        approvalStatus: 'approved',
      },
    );

    // §2.1 preserve the co-organizer invitation notification flow
    validCoOrganizers.forEach((co) => {
      this.notificationsService.create({
        toUsername: co,
        type: 'co-organizer-invite',
        title: '🏆 Co-Organizer Invitation',
        body: `@${createdBy} added you as a co-organizer for "${competition.name}".`,
        meta: { compId: competition.id, compName: competition.name, invitedBy: createdBy },
      }).catch(() => {});
    });

    await this.auditLog.record('COMPETITION_CREATED', {
      actor: createdBy,
      entityType: 'competition',
      entityId: competition.id,
      details: `Created "${competition.name}" (visibility=${visibility}).`,
      metadata: { prize: competition.prize ?? 0, game: competition.game, type: competition.type },
    });

    return competition as any;
  }

  async getCompetitionById(id: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) return comp;
    // §2.4 — never expose a private competition's join code on the public
    // detail endpoint. The organizer-only /competitions/:id/join-code route
    // is the single authorized reveal path.
    const { joinCode, ...publicCompetition } = comp as any;
    return publicCompetition as ICompetition;
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
    const isAdmin = ['admin', 'super_admin', 'comp_admin'].includes(requesterRole);
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
    // §12.4 — joining requires the persisted (simulated) verification status.
    // Frontend gating alone is not sufficient: direct API calls are rejected here.
    const userId = typeof user === 'string' ? null : user?.id;
    if (!userId) {
      throw new ForbiddenException('Authentication is required to join a competition.');
    }
    await this.assertVerified(userId, 'join a competition');

    const comp = await this.competitionRepository.findById(competitionId);
    if (!comp) throw new NotFoundException(`Competition ${competitionId} not found`);
    if (comp.visibility === 'private') {
      if (!joinCode || String(joinCode).trim().toUpperCase() !== String(comp.joinCode || '').toUpperCase()) {
        throw new BadRequestException('Invalid join code. Please check the code with your organizer and try again.');
      }
      return { ok: true, message: `Join code verified for "${comp.name}". You can now register your team!` };
    }
    return { ok: true, message: `"${comp.name}" is open to join.` };
  }

  async getAllCompetitions(): Promise<ICompetition[]> {
    return this.competitionRepository.findAll();
  }

  async getCompetitionsByUser(userId: string): Promise<ICompetition[]> {
    return this.competitionRepository.findByCreator(userId);
  }

  async getCompetitionsByOrganizer(userId: string): Promise<ICompetition[]> {
    return this.competitionRepository.findByOrganizer(userId);
  }

  async addCoOrganizer(id: string, organizerId: string, requesterUsername: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);
    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    if (!isOrganizer) throw new ForbiddenException('Only an organizer of this competition can add co-organizers.');

    const user = await this.userRepository.findByUsername(organizerId);
    if (!user) throw new BadRequestException('This username does not exist.');
    if (String(user.username).toLowerCase() === String(comp.createdBy).toLowerCase()) {
      throw new BadRequestException('The creator is already the primary organizer.');
    }
    return this.competitionRepository.addCoOrganizer(id, user.username);
  }

  async removeCoOrganizer(id: string, organizerId: string, requesterUsername: string): Promise<ICompetition> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);
    const isOrganizer = comp.createdBy === requesterUsername || (comp.organizers || []).includes(requesterUsername);
    if (!isOrganizer) throw new ForbiddenException('Only an organizer of this competition can remove co-organizers.');
    return this.competitionRepository.removeCoOrganizer(id, organizerId);
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
    const isAdmin = ['admin', 'super_admin', 'comp_admin'].includes(requesterRole);
    if (!isOrganizer && !isAdmin) {
      throw new ForbiddenException('Only an organizer of this competition (or an admin) can update it.');
    }

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
    }

    // §3.4 date chronology whenever any date is being changed
    if (updateCompetitionDto.startDate || updateCompetitionDto.endDate || updateCompetitionDto.registrationOpenAt || updateCompetitionDto.registrationCloseAt) {
      const dateErrors = validateDateWindow({
        registrationOpenAt: updateCompetitionDto.registrationOpenAt ?? (updateCompetitionDto as any).regOpen ? new Date(updateCompetitionDto.registrationOpenAt ?? (updateCompetitionDto as any).regOpen) : (comp.registrationOpenAt ?? null),
        registrationCloseAt: updateCompetitionDto.registrationCloseAt ?? (updateCompetitionDto as any).regClose ? new Date(updateCompetitionDto.registrationCloseAt ?? (updateCompetitionDto as any).regClose) : (comp.registrationCloseAt ?? null),
        startDate: updateCompetitionDto.startDate ? new Date(updateCompetitionDto.startDate) : (comp.startDate ?? null),
        endDate: updateCompetitionDto.endDate ? new Date(updateCompetitionDto.endDate) : (comp.endDate ?? null),
      });
      if (dateErrors.length) {
        throw new BadRequestException(dateErrors.map((e) => e.message).join(' '));
      }
    }

    const updates: Partial<ICompetition> = {};
    if (updateCompetitionDto.name !== undefined) updates.name = updateCompetitionDto.name;
    if (updateCompetitionDto.description !== undefined) updates.description = updateCompetitionDto.description;
    if (updateCompetitionDto.status) updates.status = updateCompetitionDto.status;
    if (updateCompetitionDto.endDate) updates.endDate = new Date(updateCompetitionDto.endDate);
    if (updateCompetitionDto.startDate) (updates as any).startDate = new Date(updateCompetitionDto.startDate);
    if (updateCompetitionDto.maxTeams !== undefined) (updates as any).maxTeams = updateCompetitionDto.maxTeams;
    if (updateCompetitionDto.maxPlayersPerTeam !== undefined) (updates as any).maxPlayersPerTeam = updateCompetitionDto.maxPlayersPerTeam;
    if (updateCompetitionDto.entryFeeAmount !== undefined) (updates as any).entryFeeAmount = updateCompetitionDto.entryFeeAmount;
    if (updateCompetitionDto.registrationOpenAt) (updates as any).registrationOpenAt = new Date(updateCompetitionDto.registrationOpenAt);
    if ((updateCompetitionDto as any).regOpen) (updates as any).registrationOpenAt = new Date((updateCompetitionDto as any).regOpen);
    if (updateCompetitionDto.registrationCloseAt) (updates as any).registrationCloseAt = new Date(updateCompetitionDto.registrationCloseAt);
    if ((updateCompetitionDto as any).regClose) (updates as any).registrationCloseAt = new Date((updateCompetitionDto as any).regClose);

    const updated = await this.competitionRepository.update(id, updates as any);

    await this.auditLog.record('COMPETITION_UPDATED', {
      actor: requesterUsername,
      entityType: 'competition',
      entityId: id,
      details: `Updated fields: ${Object.keys(updates).join(', ') || 'none'}.`,
      metadata: { regClosed, status: updated.status },
    });

    return updated as any;
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
    const isAdmin = ['admin', 'super_admin', 'comp_admin'].includes(requesterRole);
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

  async deleteCompetition(id: string, requesterUsername: string, requesterRole: string): Promise<void> {
    const comp = await this.competitionRepository.findById(id);
    if (!comp) throw new NotFoundException(`Competition with ID ${id} not found`);
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
    return this.competitionRepository.findByStatus('active');
  }

  async setApproval(id: string, decision: string, adminUsername: string): Promise<ICompetition> {
    return this.competitionRepository.setApproval(id, decision, adminUsername);
  }
}
