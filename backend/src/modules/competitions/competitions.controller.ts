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
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto, UpdateCompetitionDto, CompetitionResponseDto, AddCoOrganizerDto } from './dto/competition.dto';
import { HeaderAuthGuard } from '../../common/decorators/header-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('competitions')
@ApiTags('Competitions')
@ApiSecurity('x-user-role')
export class CompetitionsController {
  constructor(private competitionsService: CompetitionsService) {}

  @Post()
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create and auto-approve a new competition',
    description: 'Organizers (Team Leads) and Admins can create competitions. Tournaments are auto-approved upon creation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Competition successfully created and auto-approved',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid x-user-role header',
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
    return this.competitionsService.createCompetition(createCompetitionDto, creatorId);
  }

  @Post(':id/organizers')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
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
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.addCoOrganizer(id, addCoOrganizerDto.organizerId);
  }

  @Delete(':id/organizers/:organizerId')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
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
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.removeCoOrganizer(id, organizerId);
  }

  @Get('organizer/:organizerId')
  @UseGuards(HeaderAuthGuard)
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
  @UseGuards(HeaderAuthGuard)
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
  @UseGuards(HeaderAuthGuard)
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

  @Get(':id')
  @UseGuards(HeaderAuthGuard)
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
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a competition',
    description: 'Update competition details (Admin only)',
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
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.updateCompetition(id, updateCompetitionDto);
  }

  @Patch(':id/approval')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
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
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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
  async deleteCompetition(@Param('id') id: string): Promise<void> {
    await this.competitionsService.deleteCompetition(id);
  }
}
