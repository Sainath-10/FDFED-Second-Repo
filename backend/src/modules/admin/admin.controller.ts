import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('admin')
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.COMP_ADMIN,
  UserRole.DISPUTE_ADMIN,
  UserRole.REVENUE_ADMIN,
)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin statistics (Admin only)' })
  async getAdminStats() {
    return await this.adminService.getAdminStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get admin activity logs (Admin only)' })
  async getActivityLogs(@Query('adminUsername') adminUsername?: string) {
    return await this.adminService.getActivityLogs(adminUsername);
  }

  @Post('activity')
  @ApiOperation({ summary: 'Log admin activity (Admin only)' })
  async logActivity(
    @Request() req: any,
    @Body() body: { adminUsername?: string; actionType: string; details: string; metadata?: Record<string, any> },
  ) {
    const adminUser = req.user?.username || body.adminUsername || 'admin';
    return await this.adminService.logActivity(adminUser, body.actionType, body.details, body.metadata);
  }
}

