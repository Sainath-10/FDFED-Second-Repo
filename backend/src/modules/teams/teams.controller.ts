import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto, TeamResponseDto } from './dto/team.dto';
import { HeaderAuthGuard } from '@/common/decorators/header-auth.guard';
import { RolesGuard } from '@/common/decorators/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@/common/interfaces';

@Controller('teams')
@ApiTags('Teams')
@ApiSecurity('x-user-role')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new team',
    description: 'Create a new team for a competition (Admin, Super Admin, or Team Lead)',
  })
  @ApiResponse({
    status: 201,
    description: 'Team successfully created',
    type: TeamResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid x-user-role header',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Team Lead or Admin role required',
  })
  async createTeam(
    @Body() createTeamDto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.teamsService.createTeam(createTeamDto);
  }

  @Get()
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get all teams',
    description: 'Retrieve a list of all teams',
  })
  @ApiResponse({
    status: 200,
    description: 'List of teams',
    type: [TeamResponseDto],
  })
  async getAllTeams(): Promise<TeamResponseDto[]> {
    return this.teamsService.getAllTeams();
  }

  @Get('competition/:competitionId')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get teams by competition',
    description: 'Retrieve all teams participating in a specific competition',
  })
  @ApiResponse({
    status: 200,
    description: 'List of teams in competition',
    type: [TeamResponseDto],
  })
  async getTeamsByCompetition(
    @Param('competitionId') competitionId: string,
  ): Promise<TeamResponseDto[]> {
    return this.teamsService.getTeamsByCompetition(competitionId);
  }

  @Get(':id')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get team by ID',
    description: 'Retrieve a specific team by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Team details',
    type: TeamResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async getTeam(@Param('id') id: string): Promise<TeamResponseDto> {
    return this.teamsService.getTeamById(id);
  }

  @Patch(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update team details',
    description: 'Update team name or members (Team Lead, Admin, or Super Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Team successfully updated',
    type: TeamResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  async updateTeam(
    @Param('id') id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.teamsService.updateTeam(id, updateTeamDto);
  }

  @Post(':id/members')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add member to team',
    description: 'Add a new member to a team (Team Lead, Admin, or Super Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Member successfully added',
    type: TeamResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Member already in team',
  })
  async addMember(
    @Param('id') id: string,
    @Body() addTeamMemberDto: AddTeamMemberDto,
  ): Promise<TeamResponseDto> {
    return this.teamsService.addMember(id, addTeamMemberDto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove member from team',
    description: 'Remove a member from team (Team Lead, Admin, or Super Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Member successfully removed',
    type: TeamResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove team leader',
  })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ): Promise<TeamResponseDto> {
    return this.teamsService.removeMember(id, memberId);
  }

  @Delete(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a team',
    description: 'Delete a team (Admin or Super Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Team successfully deleted',
  })
  async deleteTeam(@Param('id') id: string): Promise<void> {
    await this.teamsService.deleteTeam(id);
  }
}
