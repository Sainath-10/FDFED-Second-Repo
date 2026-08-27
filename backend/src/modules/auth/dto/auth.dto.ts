import { IsEmail, IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../common/interfaces';

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

  @ApiProperty({
    description: 'User password',
    example: 'secret123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.PARTICIPANT,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email or username',
    example: 'regular@nexus.gg',
  })
  @IsString()
  emailOrUsername: string;

  @ApiProperty({
    description: 'User password',
    example: 'regular123',
  })
  @IsString()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty()
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };

  @ApiProperty({
    description: 'JWT or authentication access token',
    example: 'token_1_1724699999',
  })
  access_token: string;

  @ApiProperty({
    description: 'Status message',
    example: 'Login successful',
  })
  message: string;
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

  @ApiProperty({
    description: 'Instructions for subsequent requests',
    example: "Use 'x-user-role: <role>' header for API requests",
  })
  message: string;
}

