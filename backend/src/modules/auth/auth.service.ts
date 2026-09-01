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
    const { email, username, password, role } = registerDto;

    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException('Email already registered');
    }
    if (await this.userRepository.usernameExists(username)) {
      throw new ConflictException('Username already taken');
    }

    const user = await this.userRepository.createWithPassword(
      email,
      username,
      password,
      role || UserRole.PARTICIPANT,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      message: 'Registration successful. You can now log in.',
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { emailOrUsername, password } = loginDto;

    const user = await this.userRepository.findWithPasswordByEmailOrUsername(emailOrUsername);
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

    // Check if user was recently revoked
    const revokedReason = user.revokedReason || null;
    if (revokedReason) {
      // Clear after read so notice only shows once
      await this.userRepository.update(user.id, { revokedReason: null as any });
    }

    // Sign JWT
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      adminType: user.adminType || user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        adminType: user.adminType || user.role,
        revokedReason: revokedReason,
      } as any,
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

  async addAdmin(dto: { username: string; email?: string; password?: string; adminType: string }) {
    const { username, email, password, adminType } = dto;
    const existing = await this.userRepository.findByEmailOrUsername(username) || (email ? await this.userRepository.findByEmailOrUsername(email) : null);
    
    // Admin role mapped directly to adminType
    const roleValue = (Object.values(UserRole).includes(adminType as any) ? adminType : UserRole.COMP_ADMIN) as UserRole;

    if (existing) {
      const updates: any = {
        role: roleValue,
        adminType: adminType,
        revokedReason: null,
      };
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 10);
      }
      return await this.userRepository.update(existing.id, updates);
    } else {
      const pwd = password || 'admin123';
      const mail = email || (username.includes('@') ? username : `${username}@nexus.gg`);
      return await this.userRepository.createWithPassword(
        mail,
        username,
        pwd,
        roleValue,
        adminType,
      );
    }
  }

  async revokeAdmin(usernameOrEmail: string, reason?: string) {
    const user = await this.userRepository.findByEmailOrUsername(usernameOrEmail);
    if (!user) throw new NotFoundException('User not found');

    const revocationReason = reason && reason.trim() ? reason.trim() : 'Administrative status revoked by Super Admin';

    return await this.userRepository.update(user.id, {
      role: UserRole.PARTICIPANT,
      adminType: null as any,
      revokedReason: revocationReason,
    });
  }

  async banUser(usernameOrEmail: string): Promise<{ banned: boolean }> {
    const success = await this.userRepository.banUser(usernameOrEmail);
    if (!success) throw new NotFoundException('User not found');
    return { banned: true };
  }

  async warnUser(usernameOrEmail: string): Promise<{ warningCount: number; banned: boolean }> {
    return this.userRepository.incrementWarning(usernameOrEmail);
  }

  async updateProfile(id: string, updates: { bio?: string; profilePicUrl?: string }) {
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
