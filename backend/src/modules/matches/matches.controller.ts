import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MatchesService } from './matches.service';

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
  @ApiOperation({ summary: 'Create / schedule a match' })
  async create(@Body() body: {
    competitionId: string;
    team1Id?: string;
    team2Id?: string;
    team1Name?: string;
    team2Name?: string;
    scheduledAt?: string;
    round?: string;
    notes?: string;
    createdBy?: string;
  }) {
    return this.service.create({
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a match' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/result')
  @ApiOperation({ summary: 'Record match result' })
  async recordResult(
    @Param('id') id: string,
    @Body() body: { winnerId: string; winnerName: string; score: string },
  ) {
    return this.service.recordResult(id, body.winnerId, body.winnerName, body.score);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a match' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { message: 'Match deleted' };
  }
}
