import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { TeamEntity } from '../../entities/team.entity';

const STAFF = ['super_admin', 'finance_moderator', 'community_moderator'];
const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();
const limitOf = (raw: string | undefined) => Math.min(Math.max(Number(raw) || 200, 1), 500);

/**
 * Read access to the activity log, with role-based limits:
 *  - /audit/mine: the signed-in user's own actions and actions that affected them;
 *  - /audit/competition/:id: a competition's timeline, for its organisers and staff.
 * Staff-wide views stay on /admin/activity.
 */
@ApiTags('Activity')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    @InjectRepository(AuditLogEntity) private readonly rows: Repository<AuditLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  @Get('mine')
  @ApiOperation({ summary: 'My activity: what I did, and actions that affected me' })
  async mine(@Request() req: any, @Query('limit') limit?: string) {
    const me = lower(req.user?.username);
    return this.rows.createQueryBuilder('a')
      .where('lower(a.actor) = :me', { me })
      .orWhere("lower(a.metadata ->> 'username') = :me", { me })
      .orWhere("lower(a.metadata ->> 'reportedUsername') = :me", { me })
      .orderBy('a."createdAt"', 'DESC')
      .take(limitOf(limit))
      .getMany();
  }

  @Get('competition/:id')
  @ApiOperation({ summary: "A competition's audit timeline (organisers and staff)" })
  async competition(@Param('id') id: string, @Request() req: any, @Query('limit') limit?: string) {
    const comp = await this.dataSource.getRepository(CompetitionEntity).findOne({ where: { id } });
    if (!comp) throw new NotFoundException('Competition not found.');
    const me = [lower(req.user?.username), lower(req.user?.email)].filter(Boolean);
    const organisers = [comp.createdBy, ...(comp.organizers || [])].map(lower);
    const staff = STAFF.includes(lower(req.user?.role));
    if (!staff && !organisers.some((o) => me.includes(o))) {
      throw new ForbiddenException('Only an organiser of this competition or platform staff can view its activity.');
    }
    const teamIds = (await this.dataSource.getRepository(TeamEntity).find({ where: { competitionId: id }, select: { id: true } })).map((t) => t.id);
    const qb = this.rows.createQueryBuilder('a')
      .where('a."entityId" = :id', { id })
      .orWhere("a.metadata ->> 'competitionId' = :id", { id })
      .orWhere("a.metadata ->> 'compId' = :id", { id });
    if (teamIds.length) qb.orWhere('a."entityId" IN (:...teamIds)', { teamIds });
    return qb.orderBy('a."createdAt"', 'DESC').take(limitOf(limit)).getMany();
  }
}
