import { IsString, IsArray, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Team name',
    example: 'Team Alpha',
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'Competition ID this team will participate in',
    example: '1',
  })
  @IsString()
  competitionId: string;

  @ApiProperty({
    description: 'Initial team members (user IDs)',
    example: ['2', '3', '4'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  members?: string[];
}

export class UpdateTeamDto {
  @ApiProperty({
    description: 'Team name',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Team members',
    required: false,
  })
  @IsArray()
  @IsOptional()
  members?: string[];
}

export class AddTeamMemberDto {
  @ApiProperty({
    description: 'User ID to add to the team',
    example: '5',
  })
  @IsString()
  memberId: string;
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

  @ApiProperty()
  members: string[];

  @ApiProperty()
  createdAt: Date;
}
