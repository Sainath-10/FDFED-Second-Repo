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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto, UpdateDisputeDto, DisputeResponseDto } from './dto/dispute.dto';
import { HeaderAuthGuard } from '@/common/decorators/header-auth.guard';
import { RolesGuard } from '@/common/decorators/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@/common/interfaces';

@Controller('disputes')
@ApiTags('Disputes')
@ApiSecurity('x-user-role')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  @UseGuards(HeaderAuthGuard)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new dispute/report',
    description: 'Create a dispute or report for a team in a competition. Automatically routes dispute to event organizers.',
  })
  @ApiResponse({
    status: 201,
    description: 'Dispute successfully created and routed to event organizers',
    type: DisputeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid x-user-role header',
  })
  async createDispute(
    @Body() createDisputeDto: CreateDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const reporter = user?.username || user?.id || 'reporter';
    return this.disputesService.createDispute(createDisputeDto, reporter);
  }

  @Get()
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get all disputes',
    description: 'Retrieve all disputes and reports (filter by status with query param)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of disputes',
    type: [DisputeResponseDto],
  })
  async getAllDisputes(
    @Query('status') status?: 'open' | 'under_review' | 'resolved' | 'escalated',
  ): Promise<DisputeResponseDto[]> {
    if (status) {
      return this.disputesService.getDisputesByStatus(status);
    }
    return this.disputesService.getAllDisputes();
  }

  @Get('organizer/:organizerId')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get disputes routed to an organizer or co-organizer',
    description: 'Retrieve all disputes assigned to competitions organized by this user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of disputes assigned to organizer',
    type: [DisputeResponseDto],
  })
  async getDisputesByOrganizer(
    @Param('organizerId') organizerId: string,
  ): Promise<DisputeResponseDto[]> {
    return this.disputesService.getDisputesByOrganizer(organizerId);
  }

  @Get('open')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get open disputes',
    description: 'Retrieve only open disputes',
  })
  @ApiResponse({
    status: 200,
    description: 'List of open disputes',
    type: [DisputeResponseDto],
  })
  async getOpenDisputes(): Promise<DisputeResponseDto[]> {
    return this.disputesService.getOpenDisputes();
  }

  @Get('escalated')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get escalated disputes',
    description: 'Retrieve escalated disputes (Admin/Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of escalated disputes',
    type: [DisputeResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async getEscalatedDisputes(): Promise<DisputeResponseDto[]> {
    return this.disputesService.getEscalatedDisputes();
  }

  @Get('competition/:competitionId')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get disputes by competition',
    description: 'Retrieve all disputes for a specific competition',
  })
  @ApiResponse({
    status: 200,
    description: 'List of disputes in competition',
    type: [DisputeResponseDto],
  })
  async getDisputesByCompetition(
    @Param('competitionId') competitionId: string,
  ): Promise<DisputeResponseDto[]> {
    return this.disputesService.getDisputesByCompetition(competitionId);
  }

  @Get(':id')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get dispute by ID',
    description: 'Retrieve a specific dispute by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispute details',
    type: DisputeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Dispute not found',
  })
  async getDispute(@Param('id') id: string): Promise<DisputeResponseDto> {
    return this.disputesService.getDisputeById(id);
  }

  @Patch(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update dispute status and add resolution notes',
    description: 'Allows event organizers or admins to review, update status, and resolve disputes',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispute successfully updated',
    type: DisputeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Dispute not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organizer or Admin role required',
  })
  async updateDispute(
    @Param('id') id: string,
    @Body() updateDisputeDto: UpdateDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const resolver = user?.username || user?.id || 'organizer';
    return this.disputesService.updateDispute(id, updateDisputeDto, resolver);
  }

  @Delete(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a dispute',
    description: 'Delete a dispute record (Super Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Dispute successfully deleted',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin role required',
  })
  async deleteDispute(@Param('id') id: string): Promise<void> {
    await this.disputesService.deleteDispute(id);
  }
}
