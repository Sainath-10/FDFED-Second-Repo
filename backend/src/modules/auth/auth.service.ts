import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { UserRepository } from './repositories/user.repository';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { UserRole } from '@/common/interfaces';
import { FileLoggerService } from '@/common/logger/file-logger.service';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private readonly fileLogger: FileLoggerService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, firstName, lastName, role, country } = registerDto;

    // Check if email already exists
    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    if (await this.userRepository.usernameExists(username)) {
      throw new ConflictException('Username already taken');
    }

    const assignedRole = role || UserRole.PARTICIPANT;
    const user = await this.userRepository.create(
      email,
      username,
      firstName,
      lastName,
      assignedRole,
    );

    // B2C Consume — Call external REST Countries API if country is provided
    let countryInfo: any = null;
    if (country) {
      countryInfo = await this.fetchCountryInfo(country);
    }

    const token = this.jwtTokenService.generateToken(user);

    this.fileLogger.log(
      `User ${user.username} (${user.role}) registered successfully`,
      'AuthService',
      { userId: user.id, role: user.role },
    );

    const response: AuthResponseDto = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      access_token: token,
      message: `Registration successful. Use 'Authorization: Bearer <access_token>' for API requests.`,
    };

    if (countryInfo) {
      response.countryInfo = countryInfo;
    }

    return response;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { emailOrUsername } = loginDto;

    const user = await this.userRepository.findByEmailOrUsername(emailOrUsername);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials. User not found.');
    }

    const token = this.jwtTokenService.generateToken(user);

    this.fileLogger.log(
      `User ${user.username} (${user.role}) logged in with JWT successfully`,
      'AuthService',
      { userId: user.id, role: user.role },
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
      access_token: token,
      message: `Login successful. Use 'Authorization: Bearer <access_token>' for API requests.`,
    };
  }

  async getProfile(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  /**
   * B2C Consume — Calls the public CountriesNow API to enrich country info.
   */
  private async fetchCountryInfo(countryName: string): Promise<any | null> {
    try {
      this.fileLogger.log(
        `[B2C-CONSUME] Calling external CountriesNow API for: "${countryName}"`,
        'AuthService',
        { externalApi: 'countriesnow.space', country: countryName },
      );

      const capitalRes = await axios.get(
        'https://countriesnow.space/api/v0.1/countries/capital',
        { timeout: 5000 },
      );

      const countries: any[] = capitalRes.data?.data || [];
      const found = countries.find(
        (c: any) => c.name.toLowerCase() === countryName.toLowerCase(),
      );

      if (!found) {
        this.fileLogger.warn(
          `[B2C-CONSUME] Country "${countryName}" not found in external API`,
          'AuthService',
          { country: countryName },
        );
        return null;
      }

      this.fileLogger.log(
        `[B2C-CONSUME] CountriesNow API responded for: "${countryName}"`,
        'AuthService',
        { country: found.name, capital: found.capital },
      );

      return {
        name: found.name,
        capital: found.capital,
        iso2: found.iso2,
        iso3: found.iso3,
        source: 'countriesnow.space (external B2C API)',
      };
    } catch (err) {
      this.fileLogger.warn(
        `[B2C-CONSUME] CountriesNow API call failed for "${countryName}": ${err.message}`,
        'AuthService',
        { country: countryName, error: err.message },
      );
      return null;
    }
  }
}
