import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamRepository } from './repositories/team.repository';
import { TeamEntity } from '../../entities/team.entity';
import { TeamJoinRequestEntity } from '../../entities/team-join-request.entity';
import { TeamInviteEntity } from '../../entities/team-invite.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { RefundRequestEntity } from '../../entities/refund-request.entity';
import { RevenueTransactionEntity } from '../../entities/revenue-transaction.entity';
import { TeamValidationMiddleware } from '../../common/middleware';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity, TeamJoinRequestEntity, TeamInviteEntity, CompetitionEntity, RefundRequestEntity, RevenueTransactionEntity]),
    NotificationsModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService, TeamRepository],
  exports: [TeamsService, TeamRepository],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TeamValidationMiddleware).forRoutes(TeamsController);
  }
}
