import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'Competition ID related to the dispute',
    example: '1',
  })
  @IsString()
  competitionId: string;

  @ApiProperty({
    description: 'Team ID involved in the dispute',
    example: '2',
  })
  @IsString()
  teamId: string;

  @ApiProperty({
    description: 'Description of the dispute or report',
    example: 'Team violated competition rules during match 5',
  })
  @IsString()
  @MinLength(10)
  description: string;
}

export class UpdateDisputeDto {
  @ApiProperty({
    description: 'Dispute status',
    enum: ['open', 'under_review', 'resolved', 'escalated'],
    required: false,
  })
  @IsEnum(['open', 'under_review', 'resolved', 'escalated'])
  @IsOptional()
  status?: 'open' | 'under_review' | 'resolved' | 'escalated';

  @ApiProperty({
    description: 'Additional description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Resolution notes or verdict from organizer/admin',
    required: false,
    example: 'Proof reviewed. Match round replay ordered.',
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

  @ApiProperty()
  teamId: string;

  @ApiProperty()
  reportedBy: string;

  @ApiProperty({ example: ['organizer_1', 'co_organizer_2'] })
  organizers: string[];

  @ApiProperty()
  description: string;

  @ApiProperty()
  status: 'open' | 'under_review' | 'resolved' | 'escalated';

  @ApiProperty({ required: false })
  resolutionNotes?: string;

  @ApiProperty({ required: false })
  resolvedBy?: string;

  @ApiProperty()
  createdAt: Date;
}
