import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { DisputesModule } from '../disputes/disputes.module';
import { RevenueModule } from '../revenue/revenue.module';
import { LoggerModule } from '@/common/logger/logger.module';

@Module({
  imports: [
    AuthModule,
    CompetitionsModule,
    DisputesModule,
    RevenueModule,
    LoggerModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
