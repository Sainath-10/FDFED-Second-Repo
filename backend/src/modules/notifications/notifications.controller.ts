import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMP_ADMIN, UserRole.DISPUTE_ADMIN, UserRole.REVENUE_ADMIN)
  @ApiOperation({ summary: 'Create a notification (Admin only)' })
  async create(
    @Body() body: { toUsername: string; type: string; status?: string; title: string; body?: string; meta?: any },
  ) {
    return this.service.create(body);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get notifications for a user' })
  async getForUser(@Request() req: any, @Param('username') username: string) {
    const isSelf = req.user?.username?.toLowerCase() === username.toLowerCase();
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user?.role);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Cannot access notifications of another user');
    }
    return this.service.getForUser(username);
  }

  @Get(':username/unread-count')
  @ApiOperation({ summary: 'Get unread notification count for a user' })
  async getUnreadCount(@Request() req: any, @Param('username') username: string) {
    const isSelf = req.user?.username?.toLowerCase() === username.toLowerCase();
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user?.role);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Cannot access notifications of another user');
    }
    const count = await this.service.getUnreadCount(username);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Request() req: any, @Param('id') id: string) {
    const notification = await this.service.findById(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    const isSelf = req.user?.username?.toLowerCase() === notification.toUsername.toLowerCase();
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user?.role);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Cannot modify notifications of another user');
    }
    return this.service.markRead(id);
  }

  @Patch('read-all/:username')
  @ApiOperation({ summary: 'Mark all notifications as read for user' })
  async markAllRead(@Request() req: any, @Param('username') username: string) {
    const isSelf = req.user?.username?.toLowerCase() === username.toLowerCase();
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user?.role);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Cannot access notifications of another user');
    }
    await this.service.markAllRead(username);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@Request() req: any, @Param('id') id: string) {
    const notification = await this.service.findById(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    const isSelf = req.user?.username?.toLowerCase() === notification.toUsername.toLowerCase();
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user?.role);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Cannot delete notifications of another user');
    }
    await this.service.delete(id);
    return { message: 'Notification deleted' };
  }
}
