import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@ApiTags('Notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  async create(
    @Body() body: { toUsername: string; type: string; status?: string; title: string; body?: string; meta?: any },
  ) {
    return this.service.create(body);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get notifications for a user' })
  async getForUser(@Param('username') username: string) {
    return this.service.getForUser(username);
  }

  @Get(':username/unread-count')
  @ApiOperation({ summary: 'Get unread notification count for a user' })
  async getUnreadCount(@Param('username') username: string) {
    const count = await this.service.getUnreadCount(username);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Patch('read-all/:username')
  @ApiOperation({ summary: 'Mark all notifications as read for user' })
  async markAllRead(@Param('username') username: string) {
    await this.service.markAllRead(username);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { message: 'Notification deleted' };
  }
}
