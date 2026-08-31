import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamRepository } from './repositories/team.repository';
import { TeamEntity } from '../../entities/team.entity';
import { TeamJoinRequestEntity } from '../../entities/team-join-request.entity';
import { TeamInviteEntity } from '../../entities/team-invite.entity';
import { TeamValidationMiddleware } from '../../common/middleware';

@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity, TeamJoinRequestEntity, TeamInviteEntity])],
  controllers: [TeamsController],
  providers: [TeamsService, TeamRepository],
  exports: [TeamsService, TeamRepository],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TeamValidationMiddleware).forRoutes(TeamsController);
  }
}
