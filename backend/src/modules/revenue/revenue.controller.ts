import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { RevenueService } from './revenue.service';

@Controller('revenue')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get('config')
  async getConfig() {
    return await this.revenueService.getConfig();
  }

  @Post('config')
  async updateConfig(@Body() body: { percentage: number; minCost: number; updatedBy?: string }) {
    return await this.revenueService.updateConfig(body);
  }

  @Get('transactions')
  async getTransactions(
    @Query('status') status?: string,
    @Query('dateFilter') dateFilter?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.revenueService.getTransactions({ status, dateFilter, page, limit });
  }

  @Post('transactions')
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
