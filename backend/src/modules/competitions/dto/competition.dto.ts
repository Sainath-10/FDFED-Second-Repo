import { IsString, IsDateString, IsEnum, IsOptional, MinLength, MaxLength, IsArray, IsNumber, IsBoolean, ValidateNested, IsInt, Min, Max, IsIn, ArrayMaxSize, IsEmail, Matches } from 'class-validator';
import { SUPPORTED_GAMES, SUPPORTED_FORMATS, COMPETITION_TYPES, CREATABLE_FEE_TYPES, MAX_TEAMS_LIMIT, MAX_PLAYERS_LIMIT, MAX_PRIZE_POOL, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from '../../../common/validation/competition.rules';
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

/** Required when the prize pool is above ₹10,00,000: how finance can reach the organiser. */
export class OrganiserContactDto {
  @IsString() @MinLength(2) @MaxLength(80)
  fullName: string;

  @IsString() @Matches(/^\+?[0-9][0-9 -]{7,17}$/, { message: 'Enter a valid phone number (digits, spaces or dashes, optionally starting with +).' })
  phone: string;

  @IsEmail({}, { message: 'Enter a valid contact email.' }) @MaxLength(120)
  email: string;

  @IsOptional() @IsString() @MaxLength(120)
  organisation?: string;

  @IsString() @MinLength(20, { message: 'Explain in at least 20 characters how the prize pool is funded and why it is this large.' }) @MaxLength(2000)
  purpose: string;
}

export class CreateCompetitionDto {
  @ApiProperty({
    description: 'Competition name',
    example: 'Football Championship 2024',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(MAX_NAME_LENGTH)
  name: string;

  @ApiProperty({
    description: 'Competition description',
    example: 'Annual football championship for all teams',
  })
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
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
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsOptional()
  coOrganizers?: string[];

  @ApiProperty({ required: false })
  @IsIn(SUPPORTED_GAMES, { message: `game must be one of: ${SUPPORTED_GAMES.join(', ')}` })
  @IsOptional()
  game?: string;

  @ApiProperty({ required: false })
  @IsIn(COMPETITION_TYPES)
  @IsOptional()
  type?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  prizePool?: string;

  @ApiProperty({ required: false })
  @IsInt({ message: 'Prize pool must be a whole number of rupees.' })
  @Min(0)
  @Max(MAX_PRIZE_POOL)
  @IsOptional()
  prize?: number;

  /** §2.2 — full prize distribution; the backend caps the total at ₹10,00,000. */
  @ApiProperty({ required: false, type: [PrizeDistributionDto] })
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PrizeDistributionDto)
  @IsOptional()
  prizes?: PrizeDistributionDto[];

  @ApiProperty({ required: false, description: 'Organiser contact details; required when the prize pool is above ₹10,00,000.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganiserContactDto)
  contactDetails?: OrganiserContactDto;

  @ApiProperty({ required: false })
  @IsIn(SUPPORTED_FORMATS, { message: `format must be one of: ${SUPPORTED_FORMATS.join(', ')}` })
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
  @IsInt({ message: 'Max teams must be a whole number.' })
  @Min(2)
  @Max(MAX_TEAMS_LIMIT)
  @IsOptional()
  maxTeams?: number;

  @ApiProperty({ required: false })
  @IsInt({ message: 'Max players per team must be a whole number.' })
  @Min(1)
  @Max(MAX_PLAYERS_LIMIT)
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

  @ApiProperty({ required: false, enum: CREATABLE_FEE_TYPES, description: "'paid' means every player pays the entry fee (stored as per_player)." })
  @IsIn(CREATABLE_FEE_TYPES, { message: 'The entry fee must be Free or Paid.' })
  @IsOptional()
  feeType?: string;

  @ApiProperty({ required: false })
  @IsInt({ message: 'Entry fee must be a whole number of rupees.' })
  @Min(0)
  @Max(MAX_PRIZE_POOL)
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
  @ApiProperty({ description: 'Username of the co-organizer to invite', example: 'co_organizer_user' })
  @IsString()
  @MaxLength(60)
  organizerId: string;
}

export class ApprovalDecisionDto {
  @ApiProperty({ enum: ['approved', 'rejected', 'pending'] })
  @IsIn(['approved', 'rejected', 'pending'])
  decision: string;
}

export class UpdateCompetitionDto {
  @ApiProperty({ required: false, description: 'Competition banner image; empty string removes it' })
  @IsString()
  @IsOptional()
  img?: string;

  @ApiProperty({
    description: 'Competition name',
    required: false,
  })
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Competition description',
    required: false,
  })
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsIn(SUPPORTED_GAMES, { message: `game must be one of: ${SUPPORTED_GAMES.join(', ')}` })
  @IsOptional()
  game?: string;

  @ApiProperty({ required: false })
  @IsIn(COMPETITION_TYPES)
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
  @IsInt()
  @Min(2)
  @Max(MAX_TEAMS_LIMIT)
  @IsOptional()
  maxTeams?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(MAX_PLAYERS_LIMIT)
  @IsOptional()
  maxPlayersPerTeam?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(0)
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
  @ArrayMaxSize(10)
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
