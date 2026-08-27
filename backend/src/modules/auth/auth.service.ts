import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './repositories/user.repository';
import { RegisterDto, LoginDto, AuthResponseDto, LoginResponseDto } from './dto/auth.dto';
import { UserRole } from '../../common/interfaces';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, firstName, lastName, password, role } = registerDto;

    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException('Email already registered');
    }
    if (await this.userRepository.usernameExists(username)) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepository.create(
      email,
      username,
      firstName,
      lastName,
      passwordHash,
      role || UserRole.PARTICIPANT,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      message: 'Registration successful. You can now log in.',
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { emailOrUsername, password } = loginDto;

    const user = await this.userRepository.findByEmailOrUsername(emailOrUsername);
    if (!user) {
      throw new NotFoundException('No user found with those credentials');
    }
    if (user.banned) {
      throw new UnauthorizedException('Your account has been permanently banned from this platform');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Sign JWT
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      access_token: accessToken,
      message: 'Login successful',
    };
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAllUsers() {
    return this.userRepository.findAll();
  }

  async banUser(usernameOrEmail: string): Promise<{ banned: boolean }> {
    const success = await this.userRepository.banUser(usernameOrEmail);
    if (!success) throw new NotFoundException('User not found');
    return { banned: true };
  }

  async warnUser(usernameOrEmail: string): Promise<{ warningCount: number; banned: boolean }> {
    return this.userRepository.incrementWarning(usernameOrEmail);
  }

  async updateProfile(id: string, updates: { firstName?: string; lastName?: string; bio?: string; profilePicUrl?: string }) {
    return this.userRepository.update(id, updates);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(id, newHash);
  }
}
