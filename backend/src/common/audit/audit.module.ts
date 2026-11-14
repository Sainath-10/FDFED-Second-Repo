import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { TeamEntity } from '../../entities/team.entity';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, CompetitionEntity, TeamEntity])],
  controllers: [AuditController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
