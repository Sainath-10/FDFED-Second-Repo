import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@/common/interfaces';

export class CreateAdminDto {
  @ApiProperty({ example: 'new.admin@nexus.gg' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'new_admin' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Vance' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    enum: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    default: UserRole.ADMIN,
  })
  @IsEnum([UserRole.ADMIN, UserRole.SUPER_ADMIN])
  @IsOptional()
  role?: UserRole;
}

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  role: UserRole;
}
