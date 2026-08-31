import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getAdminStats() {
    return await this.adminService.getAdminStats();
  }

  @Get('activity')
  async getActivityLogs(@Query('adminUsername') adminUsername?: string) {
    return await this.adminService.getActivityLogs(adminUsername);
  }

  @Post('activity')
  async logActivity(
    @Body() body: { adminUsername: string; actionType: string; details: string; metadata?: Record<string, any> },
  ) {
    return await this.adminService.logActivity(body.adminUsername, body.actionType, body.details, body.metadata);
  }
}
