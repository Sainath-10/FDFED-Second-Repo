import { IsString, IsDateString, IsEnum, IsOptional, MinLength } from 'class-validator';
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
  status: 'draft' | 'active' | 'completed';

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;
}
