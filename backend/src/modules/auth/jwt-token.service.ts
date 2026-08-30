import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { IUser, UserRole } from '@/common/interfaces';

export interface JwtPayload {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtTokenService {
  private readonly secret: string = process.env.JWT_SECRET || 'nexus_super_secret_jwt_key_2026';

  generateToken(user: IUser): string {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, this.secret, { expiresIn: '7d' as jwt.SignOptions['expiresIn'] });
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch (err) {
      return null;
    }
  }
}
