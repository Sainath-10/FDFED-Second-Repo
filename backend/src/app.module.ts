import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { MatchesModule } from './modules/matches/matches.module';
import { RevenueModule } from './modules/revenue/revenue.module';
import { AdminModule } from './modules/admin/admin.module';
import { VerificationModule } from './modules/verification/verification.module';
import { SeederService } from './database/seeder.service';

import { SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware } from './common/middleware';

import { UserEntity } from './entities/user.entity';
import { CompetitionEntity } from './entities/competition.entity';
import { TeamEntity } from './entities/team.entity';
import { MatchEntity } from './entities/match.entity';
import { DisputeEntity } from './entities/dispute.entity';
import { NotificationEntity } from './entities/notification.entity';
import { TeamJoinRequestEntity } from './entities/team-join-request.entity';
import { TeamInviteEntity } from './entities/team-invite.entity';
import { PlatformPolicyEntity } from './entities/platform-policy.entity';
import { RevenueTransactionEntity } from './entities/revenue-transaction.entity';
import { RevenueConfigEntity } from './entities/revenue-config.entity';
import { AdminActivityLogEntity } from './entities/admin-activity-log.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { RefundRequestEntity } from './entities/refund-request.entity';
import { WorkflowEnhancements1710000000000 } from './database/migrations/1710000000000-workflow-enhancements';

@Module({
  imports: [
    // Config (loads .env globally)
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'backend/.env'] }),

    // PostgreSQL via TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const connection = databaseUrl
          ? { type: 'postgres' as const, url: databaseUrl }
          : {
            type: 'postgres' as const,
            host: config.get<string>('DB_HOST', '127.0.0.1'),
            port: Number(config.get<string>('DB_PORT', '5432')),
            username: config.get<string>('DB_USERNAME') || config.get<string>('DB_USER') || 'postgres',
            password: config.get<string>('DB_PASSWORD', 'postgres'),
            database: config.get<string>('DB_DATABASE') || config.get<string>('DB_NAME') || 'nexus_db',
          };

        return {
          ...connection,
          entities: [
            UserEntity,
            CompetitionEntity,
            TeamEntity,
            MatchEntity,
            DisputeEntity,
            NotificationEntity,
            TeamJoinRequestEntity,
            TeamInviteEntity,
            PlatformPolicyEntity,
            RevenueTransactionEntity,
            RevenueConfigEntity,
            AdminActivityLogEntity,
            AuditLogEntity,
            RefundRequestEntity,
          ],
          // §1.5 — schema changes are applied through migrations, never by
          // automatic synchronization. Set DB_SYNCHRONIZE=true only for a
          // throwaway local database.
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
          migrations: [WorkflowEnhancements1710000000000],
          migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') !== 'false',
          logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
        };
      },
    }),

    // JWT globally available
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'nexus_fallback_secret'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') || config.get<string>('JWT_EXPIRATION') || '7d') as any,
        },
      }),
    }),

    LoggerModule,
    AuthModule,
    CompetitionsModule,
    TeamsModule,
    DisputesModule,
    UploadModule,
    NotificationsModule,
    PoliciesModule,
    MatchesModule,
    RevenueModule,
    AdminModule,
    VerificationModule,
  ],
  providers: [SeederService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RateLimiterMiddleware, LoggingMiddleware)
      .forRoutes('*');
  }
}
