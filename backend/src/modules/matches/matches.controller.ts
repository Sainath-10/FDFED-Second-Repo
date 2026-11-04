import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleMatchDto {
  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

@Controller('matches')
@ApiTags('Matches')
export class MatchesController {
  constructor(private readonly service: MatchesService) {}

  @Get('competition/:competitionId')
  @ApiOperation({ summary: 'Get all matches for a competition' })
  async getByCompetition(@Param('competitionId') competitionId: string) {
    return this.service.findByCompetition(competitionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match by ID' })
  async getById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create / schedule a match (Organizers / Admins only)' })
  async create(
    @Request() req: any,
    @Body() body: {
      competitionId: string;
      team1Id?: string;
      team2Id?: string;
      team1Name?: string;
      team2Name?: string;
      scheduledAt?: string;
      round?: string;
      notes?: string;
      createdBy?: string;
    },
  ) {
    const createdBy = req.user?.username || body.createdBy || 'system';
    return this.service.create({
      ...body,
      createdBy,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Post('competition/:competitionId/generate-schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate fixtures for the selected tournament format (§8). Safe regeneration: requires confirmOverlap=true when scheduled matches would change.' })
  async generateSchedule(
    @Param('competitionId') competitionId: string,
    @Body() body: { confirmOverlap?: boolean; matchDurationMinutes?: number; intervalMinutes?: number; seedOrder?: string[] },
    @Request() req?: any,
  ) {
    return this.service.generateSchedule(
      competitionId,
      req?.user?.username || 'system',
      body || {},
      req?.user?.role || '',
    );
  }

  @Post('competition/:competitionId/complete-bracket')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async completeBracket(@Param('competitionId') competitionId: string, @Request() req: any, @Body() body?: { seedOrder?: string[] }) {
    return this.service.completeBracket(competitionId, req.user.username, req.user.role, body?.seedOrder);
  }

  @Get('competition/:competitionId/standings')
  @ApiOperation({ summary: 'League standings computed from verified completed matches only (§10)' })
  async getStandings(@Param('competitionId') competitionId: string) {
    return this.service.getStandings(competitionId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a match (Organizers / Admins only)' })
  async update(@Param('id') id: string, @Body() body: RescheduleMatchDto, @Request() req?: any) {
    const match = await this.service.findById(id);
    await this.service.assertOrganizer(match.competitionId, req.user.username, req.user.role);
    return this.service.updateSchedule(id, { ...body, scheduledAt: new Date(body.scheduledAt) }, req.user.username);
  }

  @Patch(':id/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record match result (Organizers / Admins only)' })
  async recordResult(
    @Param('id') id: string,
    @Body() body: { winnerId: string; winnerName: string; score: string },
    @Request() req?: any,
  ) {
    const match = await this.service.findById(id);
    await this.service.assertOrganizer(match.competitionId, req.user.username, req.user.role);
    return this.service.recordResult(id, body.winnerId, body.winnerName, body.score, req?.user?.username || 'system');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a match (Admins only)' })
  async delete(@Param('id') id: string, @Request() req?: any) {
    await this.service.delete(id, req?.user?.username || 'admin');
    return { message: 'Match deleted' };
  }
}

