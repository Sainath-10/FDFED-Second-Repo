import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../entities/user.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { DisputeEntity } from '../../entities/dispute.entity';
import { AdminActivityLogEntity } from '../../entities/admin-activity-log.entity';
import { AdminService } from './admin.service';
import { AdminController, PlatformController } from './admin.controller';
import { TeamEntity } from '../../entities/team.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { PlatformSettingEntity } from '../../entities/platform-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      CompetitionEntity,
      DisputeEntity,
      AdminActivityLogEntity,
      TeamEntity,
      AuditLogEntity,
      PlatformSettingEntity,
    ]),
  ],
  controllers: [AdminController, PlatformController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
