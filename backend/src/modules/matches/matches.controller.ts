import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

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
  @Roles(UserRole.TEAM_LEAD, UserRole.COMP_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.COMP_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a match (Organizers / Admins only)' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/result')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.COMP_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record match result (Organizers / Admins only)' })
  async recordResult(
    @Param('id') id: string,
    @Body() body: { winnerId: string; winnerName: string; score: string },
  ) {
    return this.service.recordResult(id, body.winnerId, body.winnerName, body.score);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMP_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a match (Admins only)' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { message: 'Match deleted' };
  }
}

