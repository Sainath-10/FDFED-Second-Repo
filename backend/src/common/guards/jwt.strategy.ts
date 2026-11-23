import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { requireJwtSecret } from '../config/jwt-secret';
import { hasRetiredStaffRole } from '../interfaces';

export interface JwtPayload {
  sub: string;       // user UUID
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.banned) throw new UnauthorizedException('Account has been banned');
    // A token issued before a role was retired must stop working immediately.
    if (hasRetiredStaffRole(user)) throw new UnauthorizedException('This administrator role has been removed from the platform.');
    return user;
  }
}
