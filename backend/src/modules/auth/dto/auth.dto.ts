import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@/common/interfaces';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Username for identification',
    example: 'john_doe',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    example: UserRole.PARTICIPANT,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'User password (optional)',
    example: 'secret123',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description:
      'Country name (optional). If provided, your backend will call the REST Countries external API ' +
      '(B2C consume pattern) to validate and enrich the country info.',
    example: 'India',
  })
  @IsString()
  @IsOptional()
  country?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email or username',
    example: 'admin@nexus.gg',
  })
  @IsString()
  emailOrUsername: string;

  @ApiPropertyOptional({
    description: 'User password (optional for demo accounts)',
    example: 'admin123',
  })
  @IsString()
  @IsOptional()
  password?: string;
}

export class AuthResponseDto {
  @ApiProperty()
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };

  @ApiPropertyOptional({
    description: 'JWT Bearer Access Token for authenticated requests',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token?: string;

  @ApiProperty({
    description: 'Instructions for subsequent requests',
    example: "Include 'Authorization: Bearer <access_token>' in HTTP headers",
  })
  message: string;

  @ApiPropertyOptional()
  countryInfo?: any;
}
