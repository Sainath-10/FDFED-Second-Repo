import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { UploadModule } from './modules/upload/upload.module';
import { PartnerModule } from './modules/partner/partner.module';
import { RevenueModule } from './modules/revenue/revenue.module';
import { AdminModule } from './modules/admin/admin.module';
import { SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware } from './common/middleware';

@Module({
  imports: [
    DatabaseModule,     // PostgreSQL connection + schema init
    LoggerModule,
    AuthModule,         // B2C auth + JWT token + external REST Countries API
    CompetitionsModule, // B2C CRUD + B2B webhook on create
    TeamsModule,
    DisputesModule,     // Disputes (against organizers & against users)
    UploadModule,
    PartnerModule,      // B2B expose: /partner/* with API key auth
    RevenueModule,      // Revenue model: max(₹50, 7% of prize pool)
    AdminModule,        // Admin management + stats
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware)
      .forRoutes('*');
  }
}
