import { Controller, Get, Post, Put, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

export class LogActivityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  actionType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  details: string;

  @ApiProperty({ required: false, description: 'Ignored: the actor comes from the token' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  adminUsername?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class PlatformSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowKnockout?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowRoundRobin?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(256)
  maxTeams?: number;
}

const isFinance = (user: any) => user?.role === UserRole.FINANCE_MODERATOR || user?.adminType === UserRole.FINANCE_MODERATOR;

@Controller('admin')
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform statistics (Admin only)' })
  async getAdminStats() {
    return await this.adminService.getAdminStats();
  }

  @Get('activity')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
  @ApiOperation({ summary: 'Staff activity log; finance moderators see only their own entries' })
  async getActivityLogs(@Request() req: any, @Query('adminUsername') adminUsername?: string) {
    return await this.adminService.getActivityLogs(isFinance(req.user) ? req.user.username : adminUsername);
  }

  @Post('activity')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MODERATOR)
  @ApiOperation({ summary: 'Record a staff action' })
  async logActivity(@Request() req: any, @Body() body: LogActivityDto) {
    return await this.adminService.logActivity(req.user.username, body.actionType, body.details, body.metadata);
  }

  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform settings (formats and team limit)' })
  async getSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Put('settings')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Change platform settings (Super Admin only)' })
  async updateSettings(@Request() req: any, @Body() body: PlatformSettingsDto) {
    return this.adminService.updatePlatformSettings(body, req.user.username);
  }
}

/** Public, read-only view of the settings the create form needs. */
@Controller('platform')
@ApiTags('Admin')
export class PlatformController {
  constructor(private readonly adminService: AdminService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Formats and team limit currently allowed for new competitions' })
  async getSettings() {
    return this.adminService.getPlatformSettings();
  }
}
