import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';
import { ReputationService } from './reputation.service';
import { REPUTATION_LEVELS, SANCTION_TYPES, ReputationLevel, SanctionType } from '../../common/reporting';

class EvaluateDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  qualifyingAmount?: number;

  @IsOptional()
  @IsBoolean()
  paidOnTime?: boolean;

  @IsOptional()
  @IsBoolean()
  seriousMisconduct?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  mediumViolations?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  overduePayments?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  outstandingObligations?: number;

  @IsOptional()
  @IsBoolean()
  failedPaymentDuringRecovery?: boolean;

  @IsOptional()
  @IsBoolean()
  involvedInValidDispute?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reportId?: string;
}

class PrizeExceptionDto {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  requestedAmount: number;

  @IsString()
  reason: string;
}

class ReviewExceptionDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}

class SetCeilingDto {
  @IsNumber()
  @Type(() => Number)
  maxPrizePool: number;
}

class DowngradeDto {
  @IsIn(REPUTATION_LEVELS as ReputationLevel[])
  level: ReputationLevel;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  reportId?: string;
}

class SanctionDto {
  @IsIn(SANCTION_TYPES as unknown as string[])
  type: SanctionType;

  @IsString()
  reason: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  days?: number;

  @IsOptional()
  @IsString()
  reportId?: string;
}

@ApiTags('Reputation')
@ApiBearerAuth()
@Controller('reputation')
@UseGuards(JwtAuthGuard)
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  @Get('config')
  @ApiOperation({ summary: 'Global prize-pool ceiling and per-level limits' })
  async config() {
    const maxPrizePool = await this.reputation.getGlobalMax();
    return {
      maxPrizePool,
      levelLimits: { blue: 300000, green: 300000, orange: 20000, red: 10000 },
      levels: REPUTATION_LEVELS,
    };
  }

  @Put('config')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set the platform-wide maximum prize pool (Super Admin)' })
  async setConfig(@Body() dto: SetCeilingDto, @Request() req: any) {
    const value = await this.reputation.setGlobalMax(Number(dto.maxPrizePool), req.user?.username || 'super_admin');
    return { maxPrizePool: value };
  }

  @Get('me')
  @ApiOperation({ summary: 'Current organiser reputation profile' })
  async me(@Request() req: any) {
    return this.reputation.getProfile(req.user.username);
  }

  @Get('prize-pool-exceptions/mine')
  @ApiOperation({ summary: 'My prize-pool exception requests' })
  async myExceptions(@Request() req: any) {
    return this.reputation.listExceptions({ organiserUsername: req.user.username });
  }

  @Get('prize-pool-exceptions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMP_ADMIN, UserRole.COMMUNITY_MODERATOR)
  @ApiOperation({ summary: 'Prize-pool exception requests (administrative review)' })
  async exceptions(@Query('status') status?: string) {
    return this.reputation.listExceptions({ status });
  }

  @Post('prize-pool-exceptions')
  @ApiOperation({ summary: 'Request a prize-pool exception for a competition' })
  async requestException(@Body() dto: PrizeExceptionDto, @Request() req: any) {
    return this.reputation.requestException(req.user.username, Number(dto.requestedAmount), dto.reason);
  }

  @Post('prize-pool-exceptions/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMP_ADMIN)
  @ApiOperation({ summary: 'Approve or reject a prize-pool exception' })
  async reviewException(@Param('id') id: string, @Body() dto: ReviewExceptionDto, @Request() req: any) {
    return this.reputation.reviewException(id, dto.status, dto.note || '', req.user.username);
  }

  @Post('evaluate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record reputation facts and apply the transition policy' })
  async evaluate(@Body() dto: EvaluateDto & { username?: string }, @Request() req: any) {
    const username = String((dto as any).username || '').trim();
    if (!username) throw new BadRequestException('username is required.');
    return this.reputation.evaluate(username, dto, req.user.username);
  }

  @Get('user/:username')
  @ApiOperation({ summary: 'Organiser reputation profile' })
  async profile(@Param('username') username: string, @Request() req: any) {
    const role = String(req.user?.role || '');
    const isSelf = String(req.user?.username).toLowerCase() === String(username).toLowerCase();
    const allowed = isSelf || ['community_moderator', 'super_admin', 'admin', 'comp_admin'].includes(role);
    if (!allowed) throw new ForbiddenException('You can only view your own reputation profile.');
    return this.reputation.getProfile(username);
  }

  @Get('user/:username/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR, UserRole.SUPER_ADMIN, UserRole.COMP_ADMIN)
  @ApiOperation({ summary: 'Reputation and sanction history' })
  async history(@Param('username') username: string) {
    return this.reputation.getHistory(username);
  }

  @Post('user/:username/downgrade')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Downgrade organiser reputation (moderator decision, audited)' })
  async downgrade(@Param('username') username: string, @Body() dto: DowngradeDto, @Request() req: any) {
    return this.reputation.applyDowngrade(username, dto.level, dto.reason, dto.reportId || null, req.user.username);
  }

  @Post('user/:username/sanctions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMMUNITY_MODERATOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Apply a sanction to an organiser' })
  async sanction(@Param('username') username: string, @Body() dto: SanctionDto, @Request() req: any) {
    return this.reputation.issueSanction(username, dto.type, dto.reason, {
      reportId: dto.reportId || null,
      days: dto.days,
      appliedBy: req.user.username,
    });
  }
}
