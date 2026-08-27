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

@Module({
  imports: [
    // Config (loads .env globally)
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'backend/.env'] }),

    // PostgreSQL via TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'nexus_user'),
        password: config.get<string>('DB_PASSWORD', '1234'),
        database: config.get<string>('DB_DATABASE', 'nexus_db'),
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
        ],
        synchronize: true, // Auto-create tables in dev. Use migrations in production.
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
      }),
    }),

    // JWT globally available
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'nexus_fallback_secret'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN', '7d') || '7d') as any },
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
