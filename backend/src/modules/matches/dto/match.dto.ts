import {
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMatchDto {
  @ApiProperty()
  @IsUUID('all')
  competitionId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('all')
  team1Id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('all')
  team2Id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  team1Name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  team2Name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  round?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ required: false, description: 'Ignored: the creator comes from the token' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  createdBy?: string;
}

export class SeedOrderDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(256)
  @IsUUID('all', { each: true })
  seedOrder?: string[];
}

export class GenerateScheduleDto extends SeedOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  confirmOverlap?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  matchDurationMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  intervalMinutes?: number;
}

export class RecordResultDto {
  @ApiProperty({ required: false, description: 'Winning team id; empty for a league draw' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  winnerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  winnerName?: string;

  @ApiProperty({ example: '2-1' })
  @IsString()
  @Matches(/^\s*\d{1,4}\s*[-:]\s*\d{1,4}\s*$/, { message: 'Scores must be whole numbers, for example 2-1.' })
  score: string;
}
