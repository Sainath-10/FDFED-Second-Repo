import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportEntity } from '../../entities/report.entity';
import { ReportEvidenceEntity } from '../../entities/report-evidence.entity';
import { ReportDiscussionEntity } from '../../entities/report-discussion.entity';
import { ReportDiscussionParticipantEntity } from '../../entities/report-discussion-participant.entity';
import { ReportDiscussionMessageEntity } from '../../entities/report-discussion-message.entity';
import { ReportStatusHistoryEntity } from '../../entities/report-status-history.entity';
import { ReportAuditLogEntity } from '../../entities/report-audit-log.entity';
import { ReportingRestrictionEntity } from '../../entities/reporting-restriction.entity';
import { TeamEntity } from '../../entities/team.entity';
import { MatchEntity } from '../../entities/match.entity';
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { CompetitionRemovalEntity } from '../../entities/competition-removal.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { CompetitionsModule } from '../competitions/competitions.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportEntity,
      ReportEvidenceEntity,
      ReportDiscussionEntity,
      ReportDiscussionParticipantEntity,
      ReportDiscussionMessageEntity,
      ReportStatusHistoryEntity,
      ReportAuditLogEntity,
      ReportingRestrictionEntity,
      TeamEntity,
      MatchEntity,
      ChatMessageEntity,
      AuditLogEntity,
      CompetitionRemovalEntity,
    ]),
    CompetitionsModule,
    AuthModule,
    NotificationsModule,
    ReputationModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
