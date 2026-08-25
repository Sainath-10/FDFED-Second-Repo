import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { CompetitionsController } from './modules/competitions/competitions.controller';
import { TeamsModule } from './modules/teams/teams.module';
import { TeamsController } from './modules/teams/teams.controller';
import { DisputesModule } from './modules/disputes/disputes.module';
import { DisputesController } from './modules/disputes/disputes.controller';
import { UploadModule } from './modules/upload/upload.module';
import { FileLoggerService } from './common/logger/file-logger.service';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { CompetitionAuditMiddleware } from './common/middleware/competition-audit.middleware';
import { TeamValidationMiddleware } from './common/middleware/team-validation.middleware';
import { DisputeTrackingMiddleware } from './common/middleware/dispute-tracking.middleware';

@Module({
  imports: [AuthModule, CompetitionsModule, TeamsModule, DisputesModule, UploadModule],
  controllers: [],
  providers: [FileLoggerService],
  exports: [FileLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. Application-wide Global Middleware
    consumer
      .apply(SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware)
      .forRoutes('*');

    // 2. Router-Level Scoped Middleware
    consumer
      .apply(CompetitionAuditMiddleware)
      .forRoutes(CompetitionsController);

    consumer
      .apply(TeamValidationMiddleware)
      .forRoutes(TeamsController);

    consumer
      .apply(DisputeTrackingMiddleware)
      .forRoutes(DisputesController);
  }
}
