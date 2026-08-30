import { Controller, Post, Get, Body, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { HeaderAuthGuard } from '@/common/decorators/header-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account with email, username, and password. Returns a JWT access token.',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered with JWT token',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email or username already exists',
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Authenticate and login user',
    description: 'Login with username/email. Returns a valid JWT Bearer access token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT access token',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or user not found',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(HeaderAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current authenticated user profile',
    description: 'Returns the profile for the currently logged in user based on the JWT Bearer token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
  })
  async getMe(@CurrentUser() user: any) {
    if (user.id && user.id !== 'header-user') {
      return this.authService.getProfile(user.id);
    }
    return user;
  }
}
