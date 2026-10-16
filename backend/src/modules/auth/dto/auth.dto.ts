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
    description: 'User password',
    example: 'secret123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
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
    role: UserRole;
  };

  @ApiProperty({
    description: 'Status message',
    example: 'Registration successful. You can now log in.',
  })
  message: string;
}

