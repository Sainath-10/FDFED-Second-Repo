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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto, TeamResponseDto } from './dto/team.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('teams')
@ApiTags('Teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
  @ApiBearerAuth()
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
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Team Lead or Admin role required',
  })
  async createTeam(
    @Body() createTeamDto: CreateTeamDto,
    @CurrentUser() user?: any,
  ): Promise<TeamResponseDto> {
    const leaderId = user?.username || user?.id || 'system';
    return this.teamsService.createTeam(createTeamDto, leaderId);
  }

  @Get()
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
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
    @CurrentUser() user?: any,
  ): Promise<TeamResponseDto> {
    await this.teamsService.verifyTeamOwnership(id, user);
    return this.teamsService.updateTeam(id, updateTeamDto);
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
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
    @CurrentUser() user?: any,
  ): Promise<TeamResponseDto> {
    await this.teamsService.verifyTeamOwnership(id, user);
    return this.teamsService.addMember(id, addTeamMemberDto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
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
    @CurrentUser() user?: any,
  ): Promise<TeamResponseDto> {
    await this.teamsService.verifyTeamOwnership(id, user);
    return this.teamsService.removeMember(id, memberId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team registration status (Approve / Reject)' })
  async setStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user?: any,
  ) {
    const updater = user?.username || user?.id || 'organizer';
    return this.teamsService.setStatus(id, body.status, updater);
  }

  @Post(':id/warnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue warning to team' })
  async addWarning(@Param('id') id: string, @CurrentUser() user?: any) {
    const issuer = user?.username || user?.id || 'organizer';
    return this.teamsService.addWarning(id, issuer);
  }

  @Patch(':id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban a team from tournament' })
  async banTeam(@Param('id') id: string, @CurrentUser() user?: any) {
    const issuer = user?.username || user?.id || 'organizer';
    return this.teamsService.banTeam(id, issuer);
  }

  @Post(':id/join-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Player requests to join a team' })
  async createJoinRequest(
    @Param('id') teamId: string,
    @Body() body: { competitionId: string; fromUsername: string; message?: string },
  ) {
    return this.teamsService.createJoinRequest(teamId, body.competitionId, body.fromUsername, body.message);
  }

  @Get(':id/join-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get join requests for a team' })
  async getJoinRequests(@Param('id') teamId: string, @CurrentUser() user?: any) {
    await this.teamsService.verifyTeamOwnership(teamId, user);
    return this.teamsService.getJoinRequestsByTeam(teamId);
  }

  @Patch('join-requests/:reqId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept or reject join request' })
  async updateJoinRequest(
    @Param('reqId') reqId: string,
    @Body() body: { status: string; reviewedBy?: string },
    @CurrentUser() user?: any,
  ) {
    return this.teamsService.updateJoinRequest(reqId, body.status, user);
  }

  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite player to team' })
  async createInvite(
    @Param('id') teamId: string,
    @Body() body: { competitionId: string; toUsername: string; fromUsername: string },
    @CurrentUser() user?: any,
  ) {
    await this.teamsService.verifyTeamOwnership(teamId, user);
    return this.teamsService.createInvite(teamId, body.competitionId, body.toUsername, body.fromUsername);
  }

  @Get('invites/:username')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get invites for a user' })
  async getInvites(@Param('username') username: string) {
    return this.teamsService.getInvitesByUser(username);
  }

  @Patch('invites/:inviteId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept or decline team invite' })
  async updateInvite(
    @Param('inviteId') inviteId: string,
    @Body() body: { status: string },
  ) {
    return this.teamsService.updateInvite(inviteId, body.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
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

