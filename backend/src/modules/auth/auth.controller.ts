import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, LoginResponseDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@Request() req: any) {
    return req.user;
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Patch('users/:id/ban')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban a user by ID or username/email (Admin only)' })
  async banUser(@Param('id') id: string) {
    return this.authService.banUser(id);
  }

  @Patch('users/:id/warn')
  @UseGuards(JwtAuthGuard)
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
    @Body() body: { firstName?: string; lastName?: string; bio?: string; profilePicUrl?: string },
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
