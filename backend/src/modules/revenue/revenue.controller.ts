import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RevenueService } from './revenue.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RevenueConfigDto {
  @ApiProperty() @IsNumber() @Min(0) @Max(14.99) percentage: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(99.99) minCost: number;
  @ApiProperty({ required: false, description: 'Ignored: comes from the token' })
  @IsOptional() @IsString() @MaxLength(60) updatedBy?: string;
}

export class CreateRevenueTransactionDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) competitionId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) competitionName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) organizerName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) grossAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['CONFIRMED', 'PENDING', 'FAILED']) status?: string;
}

@Controller('revenue')
@ApiTags('Revenue')
@ApiBearerAuth()
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get revenue configuration (any authenticated user)' })
  async getConfig() {
    return await this.revenueService.getConfig();
  }

  @Post('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update revenue configuration (Revenue/Super Admin only)' })
  async updateConfig(
    @Request() req: any,
    @Body() body: RevenueConfigDto,
  ) {
    const updatedBy = req.user.username;
    return await this.revenueService.updateConfig({ ...body, updatedBy });
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
  @ApiOperation({ summary: 'Create revenue transaction (Admin only)' })
  async createTransaction(
    @Body() body: CreateRevenueTransactionDto,
  ) {
    return await this.revenueService.createTransaction(body);
  }
}

