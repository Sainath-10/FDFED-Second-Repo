import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganiserReputationEntity } from '../../entities/organiser-reputation.entity';
import { OrganiserReputationHistoryEntity } from '../../entities/organiser-reputation-history.entity';
import { OrganiserSanctionEntity } from '../../entities/organiser-sanction.entity';
import { PrizePoolExceptionEntity } from '../../entities/prize-pool-exception.entity';
import { PlatformSettingEntity } from '../../entities/platform-setting.entity';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganiserReputationEntity,
      OrganiserReputationHistoryEntity,
      OrganiserSanctionEntity,
      PrizePoolExceptionEntity,
      PlatformSettingEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [ReputationController],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
