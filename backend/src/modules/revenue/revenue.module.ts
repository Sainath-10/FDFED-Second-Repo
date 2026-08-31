import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevenueConfigEntity } from '../../entities/revenue-config.entity';
import { RevenueTransactionEntity } from '../../entities/revenue-transaction.entity';
import { RevenueService } from './revenue.service';
import { RevenueController } from './revenue.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RevenueConfigEntity, RevenueTransactionEntity]),
  ],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule {}
