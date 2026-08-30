import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
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
@ApiBearerAuth()
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  @UseGuards(HeaderAuthGuard)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Submit a dispute (against an Organizer or against a User/Team)',
    description: 'Any authenticated user can submit a dispute specifying targetType as "organizer" or "user".',
  })
  @ApiResponse({
    status: 201,
    description: 'Dispute filed successfully',
    type: DisputeResponseDto,
  })
  async createDispute(
    @Body() createDisputeDto: CreateDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const reporter = user?.username || user?.id || 'system';
    return this.disputesService.createDispute(createDisputeDto, reporter);
  }

  @Get()
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get all disputes with optional filters',
    description: 'Retrieve disputes, filterable by targetType (organizer vs user) and status.',
  })
  @ApiQuery({ name: 'targetType', required: false, enum: ['organizer', 'user'] })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'under_review', 'resolved', 'escalated'] })
  @ApiResponse({
    status: 200,
    description: 'List of disputes matching query',
    type: [DisputeResponseDto],
  })
  async getAllDisputes(
    @Query('targetType') targetType?: 'organizer' | 'user',
    @Query('status') status?: string,
  ): Promise<DisputeResponseDto[]> {
    return this.disputesService.getAllDisputes(targetType, status);
  }

  @Get('target/:targetType')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get disputes specifically by target type (organizer or user)',
    description: 'Fetch either disputes filed against tournament organizers or disputes filed against players/teams.',
  })
  async getDisputesByTargetType(
    @Param('targetType') targetType: 'organizer' | 'user',
  ): Promise<DisputeResponseDto[]> {
    return this.disputesService.getDisputesByTargetType(targetType);
  }

  @Get('organizer/:organizerId')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get disputes by organizer',
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
  })
  async getOpenDisputes(): Promise<DisputeResponseDto[]> {
    return this.disputesService.getOpenDisputes();
  }

  @Get('escalated')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get escalated disputes',
  })
  async getEscalatedDisputes(): Promise<DisputeResponseDto[]> {
    return this.disputesService.getEscalatedDisputes();
  }

  @Get('competition/:competitionId')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get disputes by competition ID',
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
  })
  async getDispute(@Param('id') id: string): Promise<DisputeResponseDto> {
    return this.disputesService.getDisputeById(id);
  }

  @Patch(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update dispute status and resolution verdict',
    description: 'Admins and Organizers can update dispute status and record resolution notes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispute successfully updated',
    type: DisputeResponseDto,
  })
  async updateDispute(
    @Param('id') id: string,
    @Body() updateDisputeDto: UpdateDisputeDto,
    @CurrentUser() user?: any,
  ): Promise<DisputeResponseDto> {
    const resolver = user?.username || user?.id || 'admin';
    return this.disputesService.updateDispute(id, updateDisputeDto, resolver);
  }

  @Delete(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a dispute (Admin only)',
  })
  async deleteDispute(@Param('id') id: string): Promise<void> {
    await this.disputesService.deleteDispute(id);
  }
}
