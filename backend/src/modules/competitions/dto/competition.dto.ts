import { IsString, IsDateString, IsEnum, IsOptional, MinLength, IsArray, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PrizeDistributionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  place?: string;

  @ApiProperty({ required: false, description: 'Amount, e.g. 500000 or "₹5,00,000"' })
  @IsOptional()
  amount?: string | number;
}

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

  /** §2.2 — full prize distribution; the backend caps the total at ₹10,00,000. */
  @ApiProperty({ required: false, type: [PrizeDistributionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrizeDistributionDto)
  @IsOptional()
  prizes?: PrizeDistributionDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  format?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  season?: string;

  /** §2.4 visibility: 'public' (no join code) | 'private' (join code required) */
  @ApiProperty({ enum: ['public', 'private'], required: false })
  @IsEnum(['public', 'private'])
  @IsOptional()
  visibility?: 'public' | 'private';

  /** ISO date — registration window opens (validated separately from start/end, §3.4) */
  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  registrationOpenAt?: string;

  /** ISO date — registration window closes (validated separately from start/end, §3.4) */
  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  registrationCloseAt?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  regOpen?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  regClose?: string;

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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  game?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({
    description: 'Competition status',
    enum: ['draft', 'active', 'upcoming', 'ongoing', 'completed'],
    required: false,
  })
  @IsEnum(['draft', 'active', 'upcoming', 'ongoing', 'completed'])
  @IsOptional()
  status?: 'draft' | 'active' | 'upcoming' | 'ongoing' | 'completed';

  @ApiProperty({
    description: 'End date in ISO format',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  registrationOpenAt?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  registrationCloseAt?: string;

  /** §3.3 — capacity may not decrease; validated against current values + registered teams/rosters */
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maxTeams?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maxPlayersPerTeam?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  entryFeeAmount?: number;

  /** joinCode — only used to join a private competition; never editable after creation */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  joinCode?: string;

  /** coOrganizers — validated to exist, no self-assignment, no duplicates (§2.1) */
  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  coOrganizers?: string[];

  /** Obsolete since §3.5 — rejected if present on edit. */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  format?: string;

  /** Obsolete since §3.5 — rejected if present on edit. */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  season?: string;

  /** Obsolete since §2.2 — prize pools no longer require administrative approval. */
  @ApiProperty({ required: false })
  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  approvalStatus?: 'pending' | 'approved' | 'rejected';
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

  @ApiProperty({ required: false, nullable: true })
  visibility?: string;

  @ApiProperty({ required: false, nullable: true })
  registrationOpenAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  registrationCloseAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  game?: string;

  @ApiProperty({ required: false, nullable: true })
  type?: string;

  @ApiProperty({ required: false, nullable: true })
  location?: string;

  @ApiProperty({ required: false, nullable: true })
  prizePool?: string;

  @ApiProperty({ required: false, nullable: true })
  prize?: number;

  @ApiProperty({ required: false, nullable: true })
  format?: string;

  @ApiProperty({ required: false, nullable: true })
  season?: string;

  @ApiProperty() maxTeams?: number;

  @ApiProperty() maxPlayersPerTeam?: number;  @ApiProperty({ required: false, nullable: true })
  img?: string;

  @ApiProperty()
  createdAt: Date;
}

export class JoinValidateDto {
  @ApiProperty({ description: 'Competition id to join' })
  @IsString()
  competitionId: string;

  @ApiProperty({ description: 'Join code required only for private competitions', required: false })
  @IsString()
  @IsOptional()
  joinCode?: string;
}
