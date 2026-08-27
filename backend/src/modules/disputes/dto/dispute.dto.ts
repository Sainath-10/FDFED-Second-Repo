import { IsString, IsEnum, IsOptional, MinLength, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatus, DisputeTargetType } from '../../../common/interfaces';

// ─── Player Creates Dispute ───────────────────────────────────────────────────
export class CreateDisputeDto {
  @ApiProperty({ description: 'Competition ID related to the dispute', example: '1' })
  @IsString()
  competitionId: string;

  @ApiProperty({ description: 'Match ID (optional)', required: false })
  @IsString()
  @IsOptional()
  matchId?: string;

  @ApiProperty({ description: 'Team ID (optional, if against a team)', required: false })
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiProperty({
    description: 'Who the dispute is against',
    enum: DisputeTargetType,
    example: DisputeTargetType.OPPONENT_TEAM,
  })
  @IsEnum(DisputeTargetType)
  targetType: DisputeTargetType;

  @ApiProperty({ description: 'Offending player username or team name', required: true, example: 'TeamStormRiders' })
  @IsString()
  @MinLength(2)
  targetUserOrTeam: string;

  @ApiProperty({ description: 'Reason / description of the dispute', example: 'Opponent cheated in round 3' })
  @IsString()
  @MinLength(10)
  reason: string;

  @ApiProperty({ description: 'Evidence URLs (screenshots, videos, etc.)', required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
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
  notes: string;

  @ApiProperty({ description: 'Request platform admin to ban the offending player (only for escalation)', required: false })
  @IsBoolean()
  @IsOptional()
  requestBan?: boolean;
}

// ─── Admin Resolves Dispute ────────────────────────────────────────────────────
export class AdminResolveDisputeDto {
  @ApiProperty({ enum: ['resolve', 'resolve_and_ban'], description: 'Admin resolution action' })
  @IsEnum(['resolve', 'resolve_and_ban'])
  action: 'resolve' | 'resolve_and_ban';

  @ApiProperty({ description: 'Admin resolution notes', example: 'Evidence verified. Ban applied.' })
  @IsString()
  @MinLength(5)
  resolutionNotes: string;

  @ApiProperty({ description: 'Username of the player to ban (required when action is resolve_and_ban)', required: false })
  @IsString()
  @IsOptional()
  targetUsernameToBan?: string;
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
