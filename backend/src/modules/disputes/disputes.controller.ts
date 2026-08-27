import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import {
  CreateDisputeDto,
  OrganizerReviewDisputeDto,
  AdminResolveDisputeDto,
  DisputeResponseDto,
} from './dto/dispute.dto';
import { HeaderAuthGuard } from '../../common/decorators/header-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, DisputeStatus } from '../../common/interfaces';

@Controller('disputes')
@ApiTags('Disputes')
@ApiSecurity('x-user-role')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  // ─── Player: Create a Dispute ─────────────────────────────────────────────────
  @Post()
  @UseGuards(HeaderAuthGuard)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Raise a dispute',
    description:
      'Player raises a dispute. If targetType is "organizer", it routes directly to the Platform Admin queue. Otherwise, it routes to the Tournament Organizer queue.',
  })
  @ApiResponse({ status: 201, description: 'Dispute created and routed', type: DisputeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createDispute(
    @Body() dto: CreateDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const reporter = user?.username || user?.id || 'anonymous';
    return this.disputesService.createDispute(dto, reporter);
  }

  // ─── Organizer: Review Dispute (resolve or escalate to admin) ─────────────────
  @Post(':id/organizer-review')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Organizer reviews a dispute',
    description:
      'Tournament organizer can resolve the dispute or escalate it to the Platform Admin (with an optional ban request).',
  })
  @ApiResponse({ status: 200, description: 'Dispute reviewed', type: DisputeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — organizer or admin role required' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async organizerReview(
    @Param('id') id: string,
    @Body() dto: OrganizerReviewDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const organizer = user?.username || user?.id || 'organizer';
    return this.disputesService.organizerReviewDispute(id, dto, organizer);
  }

  // ─── Admin: Resolve Dispute (optionally ban player) ───────────────────────────
  @Post(':id/admin-resolve')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin resolves a dispute',
    description:
      'Platform Admin resolves a dispute and can optionally issue a platform-wide ban on the offending player.',
  })
  @ApiResponse({ status: 200, description: 'Dispute resolved', type: DisputeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async adminResolve(
    @Param('id') id: string,
    @Body() dto: AdminResolveDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const admin = user?.username || user?.id || 'admin';
    return this.disputesService.adminResolveDispute(id, dto, admin);
  }

  // ─── Organizer Queue ──────────────────────────────────────────────────────────
  @Get('organizer-queue')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get organizer dispute queue',
    description: 'Returns all disputes in the open_organizer and under_review states.',
  })
  @ApiResponse({ status: 200, type: [DisputeResponseDto] })
  async getOrganizerQueue(): Promise<DisputeResponseDto[]> {
    return this.disputesService.getOrganizerQueue();
  }

  // ─── Admin Queue ──────────────────────────────────────────────────────────────
  @Get('admin-queue')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin dispute queue',
    description: 'Returns all disputes in open_admin and escalated_to_admin states.',
  })
  @ApiResponse({ status: 200, type: [DisputeResponseDto] })
  async getAdminQueue(): Promise<DisputeResponseDto[]> {
    return this.disputesService.getAdminQueue();
  }

  // ─── All Disputes (admin view) ────────────────────────────────────────────────
  @Get()
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({ summary: 'Get all disputes', description: 'Filter by status via query param' })
  @ApiResponse({ status: 200, type: [DisputeResponseDto] })
  async getAllDisputes(
    @Query('status') status?: DisputeStatus,
  ): Promise<DisputeResponseDto[]> {
    if (status) return this.disputesService.getDisputesByStatus(status);
    return this.disputesService.getAllDisputes();
  }

  // ─── By Competition ───────────────────────────────────────────────────────────
  @Get('competition/:competitionId')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({ summary: 'Get disputes by competition' })
  @ApiResponse({ status: 200, type: [DisputeResponseDto] })
  async getByCompetition(@Param('competitionId') cid: string): Promise<DisputeResponseDto[]> {
    return this.disputesService.getDisputesByCompetition(cid);
  }

  // ─── Single Dispute ───────────────────────────────────────────────────────────
  @Get(':id')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({ summary: 'Get dispute by ID' })
  @ApiResponse({ status: 200, type: DisputeResponseDto })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async getDispute(@Param('id') id: string): Promise<DisputeResponseDto> {
    return this.disputesService.getDisputeById(id);
  }

  // ─── Delete (admin only) ──────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a dispute (Admin only)' })
  @ApiResponse({ status: 204, description: 'Dispute deleted' })
  async deleteDispute(@Param('id') id: string): Promise<void> {
    await this.disputesService.deleteDispute(id);
  }
}
