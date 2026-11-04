import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionRepository } from './repositories/competition.repository';
import { CompetitionEntity } from '../../entities/competition.entity';
import { CompetitionAuditMiddleware } from '../../common/middleware';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamEntity } from '../../entities/team.entity';
import { CompetitionRemovalEntity } from '../../entities/competition-removal.entity';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [TypeOrmModule.forFeature([CompetitionEntity, TeamEntity, CompetitionRemovalEntity]), NotificationsModule, ReputationModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, CompetitionRepository],
  exports: [CompetitionsService, CompetitionRepository],
})
export class CompetitionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CompetitionAuditMiddleware).forRoutes(CompetitionsController);
  }
}
