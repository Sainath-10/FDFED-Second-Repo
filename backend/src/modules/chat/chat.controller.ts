import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatPostDto } from './dto/chat-post.dto';

@Controller('chat')
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('competitions/:competitionId/announcements')
  announcements(@Param('competitionId') id: string, @Request() request: any) {
    return this.chat.listCompetition(id, 'announcements', request.user.username);
  }

  @Post('competitions/:competitionId/announcements')
  postAnnouncement(@Param('competitionId') id: string, @Request() request: any, @Body() body: ChatPostDto) {
    return this.chat.postCompetition(id, 'announcements', request.user.username, body.body);
  }

  @Get('competitions/:competitionId/general')
  general(@Param('competitionId') id: string, @Request() request: any) {
    return this.chat.listCompetition(id, 'general', request.user.username);
  }

  @Post('competitions/:competitionId/general')
  postGeneral(@Param('competitionId') id: string, @Request() request: any, @Body() body: ChatPostDto) {
    return this.chat.postCompetition(id, 'general', request.user.username, body.body);
  }

  @Get('teams/:teamId')
  team(@Param('teamId') id: string, @Request() request: any) {
    return this.chat.listTeam(id, request.user.username);
  }

  @Post('teams/:teamId')
  postTeam(@Param('teamId') id: string, @Request() request: any, @Body() body: ChatPostDto) {
    return this.chat.postTeam(id, request.user.username, body.body);
  }
}
