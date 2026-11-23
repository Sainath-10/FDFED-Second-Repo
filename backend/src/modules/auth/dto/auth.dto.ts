import {
  IsEmail,
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../common/interfaces';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Letters, digits, underscore, dot and hyphen; 3–30 characters; no spaces or markup. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;
export const USERNAME_MESSAGE =
  'Username must be 3–30 characters and use only letters, numbers, underscores, dots or hyphens.';

/** Staff roles a Super Admin may grant. */
export const GRANTABLE_ADMIN_TYPES = [
  UserRole.FINANCE_MODERATOR,
  UserRole.COMMUNITY_MODERATOR,
  UserRole.SUPER_ADMIN,
] as const;

export class RegisterDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ description: 'Username for identification', example: 'john_doe' })
  @Transform(trim)
  @IsString()
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username: string;

  @ApiProperty({ description: 'User password', example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'User email or username', example: 'regular@nexus.gg' })
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  emailOrUsername: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  @MaxLength(128)
  password: string;
}

/** Only these two fields are editable through PATCH /auth/profile. */
export class UpdateProfileDto {
  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({ required: false, description: 'A small PNG/JPEG/WEBP data URL or an http(s) image URL; empty string removes it' })
  @IsOptional()
  @IsString()
  @MaxLength(400000, { message: 'The profile picture is too large.' })
  @ValidateIf((o) => o.profilePicUrl !== '')
  @Matches(/^(data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+|https?:\/\/\S+)$/, { message: 'Profile picture must be an image.' })
  profilePicUrl?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword: string;
}

export class ChangeEmailDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ description: 'Current password, required to confirm the change' })
  @IsString()
  @MaxLength(128)
  currentPassword: string;
}

export class AddAdminDto {
  @ApiProperty({ description: 'Existing username or email to elevate, or a new username to create' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  username: string;

  @ApiProperty({ required: false, description: 'Email for a new account' })
  @IsOptional()
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ enum: GRANTABLE_ADMIN_TYPES })
  @IsIn(GRANTABLE_ADMIN_TYPES as unknown as string[], {
    message: `adminType must be one of: ${GRANTABLE_ADMIN_TYPES.join(', ')}`,
  })
  adminType: string;
}

export class RevokeAdminDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  username: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ModerationReasonDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ description: 'Username or email of the account that needs a reset' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  emailOrUsername: string;
}

export class LoginResponseDto {
  @ApiProperty()
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };

  @ApiProperty({ description: 'JWT access token' })
  access_token: string;

  @ApiProperty({ example: 'Login successful' })
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

  @ApiProperty({ example: 'Registration successful. You can now log in.' })
  message: string;
}
