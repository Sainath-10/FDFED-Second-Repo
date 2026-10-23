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
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, LoginResponseDto } from './dto/auth.dto';
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
  @ApiResponse({ status: 404, description: 'User not found' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user (fresh from DB, includes mock verification status)' })
  async getMe(@Request() req: any) {
    const fresh = await this.authService.getUserById(req.user.id);
    if (!fresh) return req.user;
    return {
      ...req.user,
      username: fresh.username,
      email: fresh.email,
      role: fresh.role,
      adminType: fresh.adminType,
      verificationStatus: fresh.verificationStatus || 'unverified',
      verifiedAt: fresh.verifiedAt || null,
      profilePicUrl: fresh.profilePicUrl || null,
      bio: fresh.bio || null,
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

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.COMP_ADMIN,
    UserRole.DISPUTE_ADMIN,
    UserRole.REVENUE_ADMIN,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Post('add-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add or elevate an administrator with specified adminType (Super Admin only)' })
  async addAdmin(
    @Body() body: { username: string; email?: string; password?: string; adminType: string },
  ) {
    return this.authService.addAdmin(body);
  }

  @Post('revoke-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke administrator status from a user with reason (Super Admin only)' })
  async revokeAdmin(
    @Body() body: { username: string; reason?: string },
  ) {
    return this.authService.revokeAdmin(body.username, body.reason);
  }

  @Patch('users/:id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPUTE_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban a user by ID or username/email (Admin only)' })
  async banUser(@Param('id') id: string) {
    return this.authService.banUser(id);
  }

  @Patch('users/:id/warn')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPUTE_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue a warning to a user (Admin only)' })
  async warnUser(@Param('id') id: string) {
    return this.authService.warnUser(id);
  }


  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(
    @Request() req: any,
    @Body() body: { bio?: string; profilePicUrl?: string },
  ) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
    return { message: 'Password changed successfully' };
  }
}
