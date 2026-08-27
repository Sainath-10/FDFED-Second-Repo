import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { DisputeRepository } from './repositories/dispute.repository';
import { CompetitionsModule } from '../competitions/competitions.module';
import { AuthModule } from '../auth/auth.module';
import { DisputeTrackingMiddleware } from '../../common/middleware';
import { DisputeEntity } from '../../entities/dispute.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DisputeEntity]),
    CompetitionsModule,
    AuthModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService, DisputeRepository],
  exports: [DisputesService, DisputeRepository],
})
export class DisputesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DisputeTrackingMiddleware).forRoutes(DisputesController);
  }
}
