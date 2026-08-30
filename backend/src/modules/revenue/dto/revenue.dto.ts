import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetCompetitionFeeDto {
  @ApiProperty({
    description: 'Entry fee per team in INR',
    example: 200,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  entryFee: number;

  @ApiProperty({
    description: 'Total prize pool in INR',
    example: 5000,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  prizePool: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'INR',
    default: 'INR',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class RecordPaymentDto {
  @ApiPropertyOptional({
    description: 'Team ID making payment or receiving payout',
  })
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiProperty({
    description: 'Amount in currency units (INR)',
    example: 350,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Type of transaction',
    enum: ['platform_fee', 'entry_fee', 'prize_payout'],
    example: 'platform_fee',
  })
  @IsEnum(['platform_fee', 'entry_fee', 'prize_payout'])
  type: 'platform_fee' | 'entry_fee' | 'prize_payout';

  @ApiPropertyOptional({
    description: 'Optional description or notes',
    example: 'Platform fee: max(₹50, 7% of ₹5,000 prize pool)',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CompetitionFeeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  competitionId: string;

  @ApiProperty({ example: 200 })
  entryFee: number;

  @ApiProperty({ example: 5000 })
  prizePool: number;

  @ApiProperty({
    description: 'Platform fee = max(₹50, 7% of prize pool)',
    example: 350,
  })
  platformFee: number;

  @ApiProperty({ example: 7.0 })
  platformFeePct: number;

  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({ example: true })
  feePaid: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  competitionId?: string;

  @ApiPropertyOptional()
  teamId?: string;

  @ApiProperty({ enum: ['platform_fee', 'entry_fee', 'prize_payout'] })
  type: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
