import { IsString, IsDateString, IsEnum, IsOptional, MinLength, IsArray, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompetitionDto {
  @ApiProperty({
    description: 'Competition name',
    example: 'Football Championship 2024',
  })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({
    description: 'Competition description',
    example: 'Annual football championship for all teams',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Start date in ISO format',
    example: '2024-06-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date in ISO format',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Initial co-organizer IDs or usernames',
    example: ['admin@nexus.gg'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  coOrganizers?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  game?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  prizePool?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  prize?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  format?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  season?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maxTeams?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maxPlayersPerTeam?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  img?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  badge?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  badgeClass?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  feeType?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  entryFeeAmount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entryFee?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  platformFee?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  organizerPaid?: boolean;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'], required: false })
  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export class AddCoOrganizerDto {
  @ApiProperty({
    description: 'User ID or username of the co-organizer to add',
    example: 'co_organizer_user',
  })
  @IsString()
  organizerId: string;
}

export class UpdateCompetitionDto {
  @ApiProperty({
    description: 'Competition name',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Competition description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Competition status',
    enum: ['draft', 'active', 'completed'],
    required: false,
  })
  @IsEnum(['draft', 'active', 'completed'])
  @IsOptional()
  status?: 'draft' | 'active' | 'completed';

  @ApiProperty({
    description: 'End date in ISO format',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class CompetitionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty({ example: ['organizer_1', 'co_organizer_2'] })
  organizers: string[];

  @ApiProperty({ required: false })
  approvalStatus?: string;

  @ApiProperty()
  createdAt: Date;
}
