import { IsString, IsEnum, IsOptional, MinLength, MaxLength, IsArray, IsBoolean, IsUUID, IsIn, ArrayMaxSize } from 'class-validator';

export const DISPUTE_CATEGORIES = ['match_result', 'cheating', 'rule_violation', 'conduct', 'prize_not_received', 'organizer_conduct', 'other'];
import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatus, DisputeTargetType } from '../../../common/interfaces';

// ─── Player Creates Dispute ───────────────────────────────────────────────────
export class CreateDisputeDto {
  @ApiProperty({ description: 'Competition ID related to the dispute' })
  @IsUUID('all', { message: 'Choose the competition this dispute is about.' })
  competitionId: string;

  @ApiProperty({ description: 'Match ID (optional)', required: false })
  @IsUUID('all', { message: 'That match id is not valid.' })
  @IsOptional()
  matchId?: string;

  @ApiProperty({ description: 'Team ID of the reporter (optional)', required: false })
  @IsUUID('all', { message: 'That team id is not valid.' })
  @IsOptional()
  teamId?: string;

  @ApiProperty({
    description: 'Who the dispute is against',
    enum: DisputeTargetType,
    example: DisputeTargetType.OPPONENT_TEAM,
  })
  @IsEnum(DisputeTargetType)
  targetType: DisputeTargetType;

  @ApiProperty({ description: 'Dispute category (optional)', required: false, enum: DISPUTE_CATEGORIES })
  @IsIn(DISPUTE_CATEGORIES)
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Offending player username or team name', required: true, example: 'TeamStormRiders' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  targetUserOrTeam: string;

  @ApiProperty({ description: 'Reason / description of the dispute', example: 'Opponent cheated in round 3' })
  @IsString()
  @MinLength(10, { message: 'Describe the problem in at least 10 characters.' })
  @MaxLength(4000)
  reason: string;

  @ApiProperty({ description: 'Evidence URLs (screenshots, videos, etc.)', required: false, type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @IsOptional()
  evidenceUrls?: string[];
}

// ─── Organizer Reviews Dispute ─────────────────────────────────────────────────
export class OrganizerReviewDisputeDto {
  @ApiProperty({ enum: ['resolve', 'escalate_to_admin'], description: 'Organizer action on the dispute' })
  @IsEnum(['resolve', 'escalate_to_admin'])
  action: 'resolve' | 'escalate_to_admin';

  @ApiProperty({ description: 'Organizer notes or resolution summary', example: 'Reviewed evidence. Opponent team warned.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  notes: string;

  @ApiProperty({ description: 'Request platform admin to ban the offending player (only for escalation)', required: false })
  @IsBoolean()
  @IsOptional()
  requestBan?: boolean;
}

// ─── Admin Resolves Dispute ────────────────────────────────────────────────────
export class OrganizerWarnDisputeDto {
  @ApiProperty({ description: 'Reason for issuing a warning to the team', example: 'Evidence confirmed. First warning issued.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  notes: string;
}

export class AdminResolveDisputeDto {
  @ApiProperty({ enum: ['resolve', 'resolve_and_ban'], description: 'Admin resolution action' })
  @IsEnum(['resolve', 'resolve_and_ban'])
  action: 'resolve' | 'resolve_and_ban';

  @ApiProperty({ description: 'Admin resolution notes', example: 'Evidence verified. Ban applied.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  resolutionNotes: string;

  @ApiProperty({ description: 'Username of the player to ban (required when action is resolve_and_ban)', required: false })
  @IsString()
  @IsOptional()
  targetUsernameToBan?: string;
}

export class EscalateDisputeDto {
  @ApiProperty({ description: 'Why platform staff should review this dispute' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}

// ─── Response DTO ─────────────────────────────────────────────────────────────
export class DisputeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() competitionId: string;
  @ApiProperty({ required: false }) matchId?: string;
  @ApiProperty({ required: false }) teamId?: string;
  @ApiProperty() reportedBy: string;
  @ApiProperty({ enum: DisputeTargetType }) targetType: DisputeTargetType;
  @ApiProperty({ required: false }) targetUserOrTeam?: string;
  @ApiProperty() reason: string;
  @ApiProperty({ type: [String], required: false }) evidenceUrls?: string[];
  @ApiProperty({ enum: DisputeStatus }) status: DisputeStatus;
  @ApiProperty({ required: false }) organizerNotes?: string;
  @ApiProperty({ required: false }) adminNotes?: string;
  @ApiProperty({ required: false }) resolvedBy?: string;
  @ApiProperty({ required: false }) banRequested?: boolean;
  @ApiProperty({ required: false }) banApplied?: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
