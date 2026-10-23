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
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto, UpdateCompetitionDto, CompetitionResponseDto, AddCoOrganizerDto, JoinValidateDto } from './dto/competition.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('competitions')
@ApiTags('Competitions')
export class CompetitionsController {
  constructor(private competitionsService: CompetitionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create and auto-approve a new competition',
    description: 'Any authenticated, verified user can create a competition. The authenticated user becomes the owner/organizer.',
  })
  @ApiResponse({
    status: 201,
    description: 'Competition successfully created and auto-approved',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organizer or Admin role required',
  })
  async createCompetition(
    @Body() createCompetitionDto: CreateCompetitionDto,
    @CurrentUser() user?: any,
  ): Promise<CompetitionResponseDto> {
    const creatorId = user?.username || user?.id || 'organizer';
    return this.competitionsService.createCompetition(createCompetitionDto, creatorId, user?.id);
  }

  @Post(':id/organizers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a co-organizer to the competition',
    description: 'Allows an organizer to add other users as co-organizers to manage the tournament and its disputes',
  })
  @ApiResponse({
    status: 200,
    description: 'Co-organizer added successfully',
    type: CompetitionResponseDto,
  })
  async addCoOrganizer(
    @Param('id') id: string,
    @Body() addCoOrganizerDto: AddCoOrganizerDto,
    @CurrentUser() user?: any,
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.addCoOrganizer(id, addCoOrganizerDto.organizerId, user?.username);
  }

  @Delete(':id/organizers/:organizerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove a co-organizer from the competition',
    description: 'Removes a co-organizer from managing the competition',
  })
  @ApiResponse({
    status: 200,
    description: 'Co-organizer removed successfully',
    type: CompetitionResponseDto,
  })
  async removeCoOrganizer(
    @Param('id') id: string,
    @Param('organizerId') organizerId: string,
    @CurrentUser() user?: any,
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.removeCoOrganizer(id, organizerId, user?.username);
  }

  @Post('join-validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validate a join attempt (public/private + join code)',
    description: 'Private competitions require a valid join code; public competitions never require one (§2.4).',
  })
  async joinValidate(@Body() dto: JoinValidateDto, @CurrentUser() user?: any) {
    // §12.4 — the authenticated account (id + username) is used for the
    // backend-enforced mock-verification gate; never trust the request body.
    return this.competitionsService.participate(dto.competitionId, dto.joinCode, user);
  }

  @Get('organizer/:organizerId')
  @ApiOperation({
    summary: 'Get competitions by organizer or co-organizer',
    description: 'Retrieve all competitions where user is primary organizer or co-organizer',
  })
  @ApiResponse({
    status: 200,
    description: 'List of competitions organized by user',
    type: [CompetitionResponseDto],
  })
  async getCompetitionsByOrganizer(
    @Param('organizerId') organizerId: string,
  ): Promise<CompetitionResponseDto[]> {
    return this.competitionsService.getCompetitionsByOrganizer(organizerId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all competitions',
    description: 'Retrieve a list of all competitions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of competitions',
    type: [CompetitionResponseDto],
  })
  async getAllCompetitions(): Promise<CompetitionResponseDto[]> {
    return this.competitionsService.getAllCompetitions();
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active competitions',
    description: 'Retrieve only active competitions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active competitions',
    type: [CompetitionResponseDto],
  })
  async getActiveCompetitions(): Promise<CompetitionResponseDto[]> {
    return this.competitionsService.getActiveCompetitions();
  }

  /** §2.4 — organizer-only reveal of a private competition's join code. */
  @Get(':id/join-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the join code of a private competition (organizer-only)',
    description: 'Returns null for public competitions. Only the competition organizer or an admin may read the code.',
  })
  async getJoinCode(@Param('id') id: string, @CurrentUser() user?: any) {
    const role = String(user?.role || 'participant');
    return this.competitionsService.getJoinCode(id, user?.username, role);
  }

  /** §13.2/§13.4 — organizer-only participant contact list (emails come from the
   * actual user accounts; never exposed publicly or to unrelated users). */
  @Get(':id/participants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Participant list with contact emails (authorized organizers/admins only)',
  })
  async getParticipants(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.competitionsService.getParticipantContacts(id, user?.username, String(user?.role || 'participant'));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get competition by ID',
    description: 'Retrieve a specific competition by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Competition details',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Competition not found',
  })
  async getCompetition(@Param('id') id: string): Promise<CompetitionResponseDto> {
    const competition = await this.competitionsService.getCompetitionById(id);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }
    return competition;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a competition',
    description: 'Update competition details (Organizer or Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Competition successfully updated',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Competition not found',
  })
  async updateCompetition(
    @Param('id') id: string,
    @Body() updateCompetitionDto: UpdateCompetitionDto,
    @CurrentUser() user?: any,
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.updateCompetition(
      id,
      updateCompetitionDto,
      user?.username || 'system',
      user?.role || '',
    );
  }

  @Patch(':id/approval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMP_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve or reject a competition',
    description: 'Update competition approval status (Admin only)',
  })
  async setApproval(
    @Param('id') id: string,
    @Body() body: { decision: string },
    @CurrentUser() user?: any,
  ): Promise<CompetitionResponseDto> {
    const adminUsername = user?.username || user?.id || 'admin';
    return this.competitionsService.setApproval(id, body.decision, adminUsername);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a competition',
    description: 'Delete a competition (Super Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Competition successfully deleted',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin role required',
  })
  async deleteCompetition(@Param('id') id: string, @CurrentUser() user?: any): Promise<void> {
    await this.competitionsService.deleteCompetition(id, user?.username || '', user?.role || '');
  }
}

