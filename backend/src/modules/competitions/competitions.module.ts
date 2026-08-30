import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionRepository } from './repositories/competition.repository';
import { CompetitionAuditMiddleware } from '../../common/middleware';
import { PartnerModule } from '../partner/partner.module';

@Module({
  imports: [PartnerModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, CompetitionRepository],
  exports: [CompetitionsService, CompetitionRepository],
})
export class CompetitionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CompetitionAuditMiddleware).forRoutes(CompetitionsController);
  }
}
