import { Controller, Post, Get, Delete, Param, Body, UseGuards, HttpCode, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto, OrganizerReviewDisputeDto, AdminResolveDisputeDto, DisputeResponseDto, EscalateDisputeDto } from './dto/dispute.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, DisputeStatus } from '../../common/interfaces';

@Controller('disputes')
@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Raise a dispute',
    description:
      'A registered player raises a dispute. Disputes against the organizer go to platform staff; others go to the competition organizer.',
  })
  @ApiResponse({ status: 201, type: DisputeResponseDto })
  async createDispute(@Body() dto: CreateDisputeDto, @CurrentUser() user: any) {
    return this.disputesService.createDispute(dto, user);
  }

  @Post(':id/organizer-review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Organizer resolves a dispute or escalates it to platform staff' })
  async organizerReview(@Param('id') id: string, @Body() dto: OrganizerReviewDisputeDto, @CurrentUser() user: any) {
    return this.disputesService.organizerReviewDispute(id, dto, user);
  }

  @Post(':id/escalate')
  @HttpCode(200)
  @ApiOperation({ summary: 'The player who raised a dispute escalates it to platform staff' })
  async escalate(@Param('id') id: string, @Body() dto: EscalateDisputeDto, @CurrentUser() user: any) {
    return this.disputesService.escalateByReporter(id, dto.reason, user);
  }

  @Post(':id/admin-resolve')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
  @ApiOperation({ summary: 'Platform staff resolve any open dispute, optionally banning an account' })
  async adminResolve(@Param('id') id: string, @Body() dto: AdminResolveDisputeDto, @CurrentUser() user: any) {
    return this.disputesService.adminResolveDispute(id, dto, user);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Disputes the signed-in player raised or that involve their teams' })
  async getMine(@CurrentUser() user: any) {
    return this.disputesService.getMyDisputes(user);
  }

  @Get('organizer-queue')
  @ApiOperation({ summary: 'Disputes waiting for the organizer, limited to competitions the caller organizes' })
  async getOrganizerQueue(@CurrentUser() user: any) {
    return this.disputesService.getOrganizerQueue(user);
  }

  @Get('admin-queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
  @ApiOperation({ summary: 'Disputes against organizers and escalated disputes' })
  async getAdminQueue() {
    return this.disputesService.getAdminQueue();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
  @ApiOperation({ summary: 'All disputes (staff only); filter with ?status=' })
  async getAllDisputes(@Query('status') status?: DisputeStatus) {
    if (status) return this.disputesService.getDisputesByStatus(status);
    return this.disputesService.getAllDisputes();
  }

  @Get('competition/:competitionId')
  @ApiOperation({ summary: 'Disputes in a competition the caller can see' })
  async getByCompetition(@Param('competitionId') cid: string, @CurrentUser() user: any) {
    return this.disputesService.getDisputesByCompetition(cid, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One dispute (reporter, involved players, organizers and staff only)' })
  async getDispute(@Param('id') id: string, @CurrentUser() user: any) {
    return this.disputesService.getDisputeById(id, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a dispute (Super Admin only)' })
  async deleteDispute(@Param('id') id: string): Promise<void> {
    await this.disputesService.deleteDispute(id);
  }
}
