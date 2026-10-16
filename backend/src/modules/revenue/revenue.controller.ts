import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RevenueService } from './revenue.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('revenue')
@ApiTags('Revenue')
@ApiBearerAuth()
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REVENUE_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get revenue configuration (Admin only)' })
  async getConfig() {
    return await this.revenueService.getConfig();
  }

  @Post('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update revenue configuration (Revenue/Super Admin only)' })
  async updateConfig(
    @Request() req: any,
    @Body() body: { percentage: number; minCost: number; updatedBy?: string },
  ) {
    const updatedBy = req.user?.username || body.updatedBy || 'admin';
    return await this.revenueService.updateConfig({ ...body, updatedBy });
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REVENUE_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get revenue transactions (Admin only)' })
  async getTransactions(
    @Query('status') status?: string,
    @Query('dateFilter') dateFilter?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.revenueService.getTransactions({ status, dateFilter, page, limit });
  }

  @Post('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REVENUE_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create revenue transaction (Admin only)' })
  async createTransaction(
    @Body() body: {
      competitionId?: string;
      competitionName?: string;
      organizerName?: string;
      grossAmount?: number;
      status?: string;
    },
  ) {
    return await this.revenueService.createTransaction(body);
  }
}

