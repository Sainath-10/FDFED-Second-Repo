import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  LoginResponseDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ChangeEmailDto,
  AddAdminDto,
  RevokeAdminDto,
  ModerationReasonDto,
  PasswordResetRequestDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email/username and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('password-reset-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Forgot password: notify administrators to issue a temporary password' })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto.emailOrUsername);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user (fresh from DB)' })
  async getMe(@Request() req: any) {
    const fresh = await this.authService.getUserById(req.user.id);
    return {
      id: fresh.id,
      username: fresh.username,
      email: fresh.email,
      role: fresh.role,
      adminType: fresh.adminType,
      profilePicUrl: fresh.profilePicUrl || null,
      bio: fresh.bio || null,
      warningCount: fresh.warningCount,
      organizerTrustScore: fresh.organizerTrustScore,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
    };
  }

  @Get('users/exists')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check whether a username exists (for co-organizer validation)' })
  async userExists(@Query('username') username: string) {
    const clean = String(username || '').trim();
    if (!clean) return { exists: false };
    const user = await this.authService.findUsername(clean);
    return { exists: !!user, username: user ? user.username : clean, role: user ? user.role : null };
  }

  /**
   * Username autocomplete for invitations. `players` (default) lists only active
   * player accounts and is open to any signed-in user; `all` also lists staff and
   * is limited to administrators (used when promoting an account).
   */
  @Get('users/search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search usernames as you type (invitations)' })
  async searchUsers(@Query('q') q: string, @Query('scope') scope: string, @Request() req: any) {
    const wantsAll = scope === 'all';
    if (wantsAll && ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user?.role)) {
      throw new ForbiddenException('Only administrators can search staff accounts.');
    }
    return this.authService.searchUsernames(String(q || ''), wantsAll ? 'all' : 'players', req.user?.username);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Post('add-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add or elevate an administrator (Super Admin only)' })
  async addAdmin(@Body() body: AddAdminDto, @Request() req: any) {
    return this.authService.addAdmin(body, req.user);
  }

  @Post('revoke-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke administrator status with a reason (Super Admin only)' })
  async revokeAdmin(@Body() body: RevokeAdminDto, @Request() req: any) {
    return this.authService.revokeAdmin(body.username, body.reason, req.user);
  }

  @Patch('users/:id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban a user by id, username or email (Admin only)' })
  async banUser(@Param('id') id: string, @Body() body: ModerationReasonDto, @Request() req: any) {
    return this.authService.banUser(id, req.user, body?.reason);
  }

  @Patch('users/:id/unban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lift a ban (Admin only)' })
  async unbanUser(@Param('id') id: string, @Request() req: any) {
    return this.authService.unbanUser(id, req.user);
  }

  @Patch('users/:id/warn')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue a warning to a user (Admin only)' })
  async warnUser(@Param('id') id: string, @Body() body: ModerationReasonDto, @Request() req: any) {
    return this.authService.warnUser(id, req.user, body?.reason);
  }

  @Post('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Issue a one-time temporary password (Admin only)' })
  async resetPassword(@Param('id') id: string, @Request() req: any) {
    return this.authService.resetPassword(id, req.user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own bio and profile picture' })
  async updateProfile(@Request() req: any, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Patch('email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own email (current password required)' })
  async changeEmail(@Request() req: any, @Body() body: ChangeEmailDto) {
    return this.authService.changeEmail(req.user.id, body.email, body.currentPassword);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    await this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
    return { message: 'Password changed successfully' };
  }
}
