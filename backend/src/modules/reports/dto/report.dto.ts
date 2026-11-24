import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

/** Longest temporary competition-creation ban a Community Moderator may set. */
export const MAX_RESTRICTION_DAYS = 365;
import { Type } from 'class-transformer';
import {
  DISCARD_REASONS,
  MODERATOR_ACTIONS,
  ORGANISER_ACTIONS,
  REPORT_FINDINGS,
  REPORT_PRIORITIES,
  REPORT_REASONS,
} from '../../../common/reporting';

export class EvidenceDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  mimetype?: string;

  @IsOptional()
  @Type(() => Number)
  size?: number;
}

export class CreateReportDto {
  @IsString()
  competitionId: string;

  @IsString()
  reportedUsername: string;

  @IsIn(Object.keys(REPORT_REASONS))
  reasonCode: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  matchId?: string;

  @IsOptional()
  @IsString()
  incidentAt?: string;

  @IsOptional()
  @IsString()
  sourcePage?: string;

  /** Original report a player is complaining about (organiser decision review). */
  @IsOptional()
  @IsString()
  originalReportId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];
}

export class DiscardReportDto {
  @IsIn(DISCARD_REASONS as unknown as string[])
  reason: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class PriorityDto {
  @IsIn(REPORT_PRIORITIES)
  priority: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class DiscussionMessageDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];
}

export class AddParticipantDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class PlayerDecisionDto {
  @IsIn(REPORT_FINDINGS)
  finding: string;

  @IsIn(ORGANISER_ACTIONS)
  action: string;

  @IsString()
  conclusion: string;
}

export class ModeratorDecisionDto {
  @IsIn(REPORT_FINDINGS)
  finding: string;

  @IsIn(MODERATOR_ACTIONS)
  action: string;

  @IsString()
  conclusion: string;

  @IsOptional()
  @IsIn(['blue', 'green', 'orange', 'red'])
  level?: 'blue' | 'green' | 'orange' | 'red';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The ban length must be a whole number of days.' })
  @Min(1, { message: 'The ban must last at least 1 day.' })
  @Max(MAX_RESTRICTION_DAYS, { message: `The ban can last at most ${MAX_RESTRICTION_DAYS} days.` })
  days?: number;
}

export class UpliftDto {
  @IsString()
  @MinLength(15)
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsIn(['reopen', 'remain_terminated'])
  competitionDisposition?: string;
}

export class AppealDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}

export class AppealDecisionDto {
  @IsIn(['revert', 'discard'])
  action: 'revert' | 'discard';

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}
