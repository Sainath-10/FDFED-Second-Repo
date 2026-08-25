import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { DisputeRepository } from './repositories/dispute.repository';
import { DisputeTrackingMiddleware } from '../../common/middleware';

@Module({
  controllers: [DisputesController],
  providers: [DisputesService, DisputeRepository],
  exports: [DisputesService, DisputeRepository],
})
export class DisputesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DisputeTrackingMiddleware).forRoutes(DisputesController);
  }
}
