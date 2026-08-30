import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { RevenueService } from './revenue.service';
import {
  SetCompetitionFeeDto,
  RecordPaymentDto,
  CompetitionFeeResponseDto,
  TransactionResponseDto,
} from './dto/revenue.dto';
import { HeaderAuthGuard } from '@/common/decorators/header-auth.guard';
import { RolesGuard } from '@/common/decorators/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/interfaces';

@Controller('revenue')
@ApiTags('Revenue')
@ApiSecurity('x-user-role')
@ApiBearerAuth()
export class RevenueController {
  constructor(private revenueService: RevenueService) {}

  @Post('competitions/:id/fees')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Configure competition fees & calculate platform fee',
    description:
      'Sets the entry fee and prize pool. Computes platform fee as max(₹50, 7% of prize pool) — whichever is higher.',
  })
  @ApiResponse({
    status: 200,
    description: 'Fee configuration saved and platform fee calculated',
    type: CompetitionFeeResponseDto,
  })
  async setCompetitionFee(
    @Param('id') competitionId: string,
    @Body() dto: SetCompetitionFeeDto,
  ): Promise<CompetitionFeeResponseDto> {
    return this.revenueService.setCompetitionFee(competitionId, dto);
  }

  @Get('competitions/:id/fees')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get competition fee configuration',
    description: 'Retrieves entry fee, prize pool, and calculated platform fee for a competition.',
  })
  @ApiResponse({
    status: 200,
    description: 'Competition fee details',
    type: CompetitionFeeResponseDto,
  })
  async getCompetitionFee(
    @Param('id') competitionId: string,
  ): Promise<CompetitionFeeResponseDto> {
    return this.revenueService.getCompetitionFee(competitionId);
  }

  @Post('competitions/:id/pay-platform-fee')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record platform fee payment by organizer',
    description: 'Marks the platform fee as paid and records a completed platform_fee transaction.',
  })
  async payPlatformFee(@Param('id') competitionId: string) {
    return this.revenueService.payPlatformFee(competitionId);
  }

  @Post('competitions/:id/payment')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Record an entry fee payment or prize payout',
    description: 'Records a financial transaction (entry_fee, prize_payout, or platform_fee).',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction recorded successfully',
    type: TransactionResponseDto,
  })
  async recordPayment(
    @Param('id') competitionId: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<TransactionResponseDto> {
    return this.revenueService.recordPayment(competitionId, dto);
  }

  @Get('stats')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get platform revenue statistics',
    description:
      'Aggregates total platform fees collected, total prize pools managed, and transaction breakdown (Admin only).',
  })
  async getRevenueStats() {
    return this.revenueService.getRevenueStats();
  }

  @Get('transactions')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all revenue transactions',
    description: 'Lists all financial transactions recorded across the platform (Admin only).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all transactions',
    type: [TransactionResponseDto],
  })
  async getTransactions(): Promise<TransactionResponseDto[]> {
    return this.revenueService.getTransactions();
  }
}
