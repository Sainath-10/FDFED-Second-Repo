import { Injectable, ConflictException } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { RegisterDto, AuthResponseDto } from './dto/auth.dto';
import { UserRole } from '@/common/interfaces';

@Injectable()
export class AuthService {
  constructor(private userRepository: UserRepository) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, firstName, lastName, role } = registerDto;

    // Check if email already exists
    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    if (await this.userRepository.usernameExists(username)) {
      throw new ConflictException('Username already taken');
    }

    const user = await this.userRepository.create(
      email,
      username,
      firstName,
      lastName,
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
      message: `Registration successful. Use 'x-user-role: ${user.role}' header for API requests.`,
    };
  }
}
