import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamRepository } from './repositories/team.repository';
import { TeamValidationMiddleware } from '../../common/middleware';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamRepository],
  exports: [TeamsService, TeamRepository],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TeamValidationMiddleware).forRoutes(TeamsController);
  }
}
