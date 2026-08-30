import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { RevenueRepository } from './repositories/revenue.repository';
import { CompetitionsModule } from '../competitions/competitions.module';
import { LoggerModule } from '@/common/logger/logger.module';

@Module({
  imports: [CompetitionsModule, LoggerModule],
  controllers: [RevenueController],
  providers: [RevenueService, RevenueRepository],
  exports: [RevenueService, RevenueRepository],
})
export class RevenueModule {}
