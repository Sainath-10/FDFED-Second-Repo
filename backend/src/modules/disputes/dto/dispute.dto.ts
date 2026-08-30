import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'Competition ID related to the dispute',
    example: '1',
  })
  @IsString()
  competitionId: string;

  @ApiPropertyOptional({
    description: 'Team ID involved in the dispute (optional if reporting organizer)',
    example: 'team-1',
  })
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiProperty({
    description: 'Target type: whether the dispute is against an organizer or a user/team',
    enum: ['organizer', 'user'],
    example: 'organizer',
    default: 'user',
  })
  @IsEnum(['organizer', 'user'])
  targetType: 'organizer' | 'user';

  @ApiPropertyOptional({
    description: 'Name or ID of the organizer, team, or player being reported',
    example: 'Tournament Admin / Organizer Alpha',
  })
  @IsString()
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Title / Subject of the dispute',
    example: 'Unfair Match Ruling — Round 18 Exploit Dispute',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Detailed description of the dispute or violation',
    example: 'Organizer refused to investigate obvious match exploit during tournament finals.',
  })
  @IsString()
  @MinLength(10)
  description: string;
}

export class UpdateDisputeDto {
  @ApiPropertyOptional({
    description: 'Dispute status',
    enum: ['open', 'under_review', 'resolved', 'escalated'],
  })
  @IsEnum(['open', 'under_review', 'resolved', 'escalated'])
  @IsOptional()
  status?: 'open' | 'under_review' | 'resolved' | 'escalated';

  @ApiPropertyOptional({
    description: 'Additional description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Resolution notes or verdict from reviewing admin or organizer',
    example: 'Reviewed logs and video evidence. Match replay granted.',
  })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}

export class DisputeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  competitionId: string;

  @ApiPropertyOptional()
  teamId?: string;

  @ApiProperty({ enum: ['organizer', 'user'], example: 'organizer' })
  targetType: 'organizer' | 'user';

  @ApiPropertyOptional()
  targetId?: string;

  @ApiProperty()
  reportedBy: string;

  @ApiProperty({ example: ['organizer_1', 'co_organizer_2'] })
  organizers: string[];

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ['open', 'under_review', 'resolved', 'escalated'] })
  status: 'open' | 'under_review' | 'resolved' | 'escalated';

  @ApiPropertyOptional()
  resolutionNotes?: string;

  @ApiPropertyOptional()
  resolvedBy?: string;

  @ApiProperty()
  createdAt: Date;
}
