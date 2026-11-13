import { IsString, IsArray, MinLength, MaxLength, IsOptional, ArrayMaxSize, IsUUID, IsIn, Matches, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Plain text only: no angle brackets, so a team name can never carry markup. */
const TEAM_NAME = /^[^<>]{3,40}$/;
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Team name',
    example: 'Team Alpha',
  })
  @Transform(trim)
  @IsString()
  @Matches(TEAM_NAME, { message: 'Team name must be 3–40 characters and cannot contain < or >.' })
  name: string;

  @ApiProperty({ description: 'Competition ID this team will participate in' })
  @IsUUID('all', { message: 'Choose a valid competition.' })
  competitionId: string;

  @ApiProperty({
    description: 'Initial team members (user IDs)',
    example: ['2', '3', '4'],
    required: false,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsOptional()
  members?: string[];

  /** §2.4 — required only when registering for a PRIVATE competition. */
  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  joinCode?: string;
}

export class DisbandTeamDto {
  @ApiProperty({ description: 'Meaningful reason for disbanding (shown to the organizer)', minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;

  @ApiProperty({ description: 'Roster known to the client; only used to address notifications, never refunds', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberUsernames?: string[];
}

export class RemoveMemberDto {
  @ApiProperty({ description: 'Mandatory meaningful reason for the removal', minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}

export class LeaveTeamDto {
  @ApiProperty({ required: false, description: 'Optional note for the team lead' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateTeamDto {
  @ApiProperty({ description: 'Team name', required: false })
  @Transform(trim)
  @IsString()
  @Matches(TEAM_NAME, { message: 'Team name must be 3–40 characters and cannot contain < or >.' })
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Team members', required: false })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsOptional()
  members?: string[];
}

export class AddTeamMemberDto {
  @ApiProperty({ description: 'Username to add to the team' })
  @IsString()
  @MaxLength(60)
  memberId: string;
}

export class TeamStatusDto {
  @ApiProperty({ enum: ['approved', 'rejected', 'banned'] })
  @IsIn(['approved', 'rejected', 'banned'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TeamReasonDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class JoinRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('all')
  competitionId?: string;

  @ApiProperty({ required: false, description: 'Ignored: identity comes from the token' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fromUsername?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  joinCode?: string;
}

export class JoinRequestDecisionDto {
  @ApiProperty({ enum: ['accepted', 'approved', 'declined', 'rejected'] })
  @IsIn(['accepted', 'approved', 'declined', 'rejected'])
  status: string;

  @ApiProperty({ required: false, description: 'Ignored: the reviewer comes from the token' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reviewedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  feeAlreadyPaid?: boolean;
}

export class CreateInviteDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  toUsername: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('all')
  competitionId?: string;

  @ApiProperty({ required: false, description: 'Ignored: the sender comes from the token' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fromUsername?: string;
}

export class InviteDecisionDto {
  @ApiProperty({ enum: ['accepted', 'declined'] })
  @IsIn(['accepted', 'declined'])
  status: string;
}

export class RefundDecisionDto {
  @ApiProperty({ enum: ['completed', 'failed', 'cancelled'] })
  @IsIn(['completed', 'failed', 'cancelled'])
  status: 'completed' | 'failed' | 'cancelled';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class TeamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  competitionId: string;

  @ApiProperty()
  leaderId: string;

  @ApiProperty({ required: false })
  members?: string[];

  @ApiProperty({ required: false })
  memberUsernames?: string[];

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false })
  warningsCount?: number;

  @ApiProperty()
  createdAt: Date;
}
