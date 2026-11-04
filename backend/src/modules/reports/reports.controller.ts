import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';
import { ReportsService } from './reports.service';
import {
  AddParticipantDto,
  CreateReportDto,
  DiscardReportDto,
  DiscussionMessageDto,
  ModeratorDecisionDto,
  PlayerDecisionDto,
  PriorityDto,
} from './dto/report.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ─── Player ─────────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({
    summary: 'File a report',
    description:
      'Validates the reporter, the accused and the competition, assigns the initial priority, links duplicates and routes the report to the organiser or the Community Moderator.',
  })
  async create(@Body() dto: CreateReportDto, @Request() req: any) {
    return this.reports.create(dto, req.user);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Reports I filed or that were filed against me' })
  async mine(@Request() req: any) {
    return this.reports.listMine(req.user.username);
  }

  @Get('restrictions/:competitionId')
  @ApiOperation({ summary: 'My discarded-report count and whether reporting is locked' })
  async restrictions(@Param('competitionId') competitionId: string, @Request() req: any) {
    return this.reports.restrictionsFor(competitionId, req.user.username);
  }

  // ─── Organiser ──────────────────────────────────────────────────────────────
  @Get('organiser')
  @ApiOperation({ summary: 'Reports queue for competitions I organise' })
  async organiserQueue(@Query('status') status: string, @Request() req: any) {
    return this.reports.listForOrganiser(req.user.username, status);
  }

  // ─── Community Moderator ────────────────────────────────────────────────────
  @Get('moderation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Reports against organisers (Community Moderator)' })
  async moderationQueue(@Query('status') status: string) {
    return this.reports.listForModeration(status);
  }

  @Get('moderation/counts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Community Moderator dashboard counters (real database counts)' })
  async moderationCounts() {
    return this.reports.dashboardCounts('moderator');
  }

  // ─── Case discussions ───────────────────────────────────────────────────────
  @Get('discussions/mine')
  @ApiOperation({ summary: 'Case discussions I participate in' })
  async myDiscussions(@Request() req: any) {
    return this.reports.listDiscussionsFor(req.user.username);
  }

  @Get('discussions/:discussionId')
  @ApiOperation({ summary: 'Case discussion room (authorised participants only)' })
  async discussion(@Param('discussionId') discussionId: string, @Request() req: any) {
    return this.reports.getDiscussion(discussionId, req.user);
  }

  @Post('discussions/:discussionId/messages')
  @ApiOperation({ summary: 'Post a message in a case discussion' })
  async postMessage(
    @Param('discussionId') discussionId: string,
    @Body() dto: DiscussionMessageDto,
    @Request() req: any,
  ) {
    return this.reports.postMessage(discussionId, dto, req.user);
  }

  @Post('discussions/:discussionId/end')
  @ApiOperation({ summary: 'End the discussion (read-only)' })
  async endDiscussion(@Param('discussionId') discussionId: string, @Request() req: any) {
    return this.reports.endDiscussion(discussionId, req.user);
  }

  @Post('discussions/:discussionId/participants')
  @ApiOperation({ summary: 'Add a relevant participant to the case discussion' })
  async addParticipant(
    @Param('discussionId') discussionId: string,
    @Body() dto: AddParticipantDto,
    @Request() req: any,
  ) {
    return this.reports.addParticipant(discussionId, dto, req.user);
  }

  @Delete('discussions/:discussionId/participants/:username')
  @ApiOperation({ summary: 'Remove an added participant' })
  async removeParticipant(
    @Param('discussionId') discussionId: string,
    @Param('username') username: string,
    @Request() req: any,
  ) {
    return this.reports.removeParticipant(discussionId, username, req.user);
  }

  // ─── Maintenance ────────────────────────────────────────────────────────────
  @Post('maintenance/escalate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Run the deadline/reminder sweep (also runs periodically)' })
  async escalate(@Request() req: any) {
    return this.reports.escalateOverdue();
  }

  @Get('maintenance/config')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Report deadline configuration' })
  async config() {
    return this.reports.getConfigValues();
  }

  // ─── Single report ──────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Report details (reviewer, participants only)' })
  async get(@Param('id') id: string, @Request() req: any) {
    return this.reports.get(id, req.user);
  }

  @Patch(':id/priority')
  @ApiOperation({ summary: 'Change the review priority (audited)' })
  async priority(@Param('id') id: string, @Body() dto: PriorityDto, @Request() req: any) {
    return this.reports.setPriority(id, dto, req.user);
  }

  @Post(':id/discard')
  @ApiOperation({ summary: 'Discard a report with a mandatory reason' })
  async discard(@Param('id') id: string, @Body() dto: DiscardReportDto, @Request() req: any) {
    return this.reports.discard(id, dto, req.user);
  }

  @Post(':id/discussion')
  @ApiOperation({ summary: 'Open the case discussion room' })
  async startDiscussion(@Param('id') id: string, @Request() req: any) {
    return this.reports.startDiscussion(id, req.user);
  }

  @Post(':id/request-response')
  @ApiOperation({ summary: 'Request additional information from the participants' })
  async requestResponse(@Param('id') id: string, @Request() req: any) {
    return this.reports.requestResponse(id, req.user);
  }

  @Post(':id/act-player')
  @ApiOperation({ summary: 'Organiser finding and action against a player' })
  async actOnPlayer(@Param('id') id: string, @Body() dto: PlayerDecisionDto, @Request() req: any) {
    return this.reports.actOnPlayer(id, dto, req.user);
  }

  @Post(':id/act-organiser')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Community Moderator finding and action against an organiser' })
  async actOnOrganiser(@Param('id') id: string, @Body() dto: ModeratorDecisionDto, @Request() req: any) {
    return this.reports.actOnOrganiser(id, dto, req.user);
  }

  @Get(':id/investigation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Investigation bundle: organiser, competition, evidence, timeline' })
  async investigation(@Param('id') id: string, @Request() req: any) {
    return this.reports.investigation(id, req.user);
  }
}
