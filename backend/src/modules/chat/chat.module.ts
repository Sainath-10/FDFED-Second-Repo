import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { CompetitionsModule } from '../competitions/competitions.module';
import { TeamsModule } from '../teams/teams.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessageEntity]), CompetitionsModule, TeamsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
