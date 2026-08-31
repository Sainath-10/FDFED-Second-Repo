import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../entities/user.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { DisputeEntity } from '../../entities/dispute.entity';
import { AdminActivityLogEntity } from '../../entities/admin-activity-log.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      CompetitionEntity,
      DisputeEntity,
      AdminActivityLogEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
