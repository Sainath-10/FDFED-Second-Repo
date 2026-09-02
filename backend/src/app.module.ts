import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { UploadModule } from './modules/upload/upload.module';
import { SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware } from './common/middleware';

@Module({
  imports: [
    LoggerModule,
    AuthModule,
    CompetitionsModule,
    TeamsModule,
    DisputesModule,
    UploadModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware)
      .forRoutes('*');
  }
}
