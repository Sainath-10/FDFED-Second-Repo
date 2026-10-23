import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchEntity } from '../../entities/match.entity';
import { CompetitionsModule } from '../competitions/competitions.module';
import { TeamsModule } from '../teams/teams.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchEntity]),
    CompetitionsModule, // exports CompetitionRepository
    TeamsModule,        // exports TeamRepository
    NotificationsModule,
    AuditModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
