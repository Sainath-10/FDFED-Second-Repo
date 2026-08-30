import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '../interfaces';

/**
 * Auth Guard — supports JWT Bearer tokens in Authorization header
 * and falls back to x-user-role header for direct role testing.
 * Sets request.user = { id, username, email, role } for @CurrentUser() and RolesGuard.
 */
@Injectable()
export class HeaderAuthGuard implements CanActivate {
  private readonly jwtSecret: string = process.env.JWT_SECRET || 'nexus_super_secret_jwt_key_2026';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // 1. If JWT Bearer token provided in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        request.user = {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role as UserRole,
        };
        return true;
      } catch (err) {
        throw new UnauthorizedException('Invalid or expired JWT token.');
      }
    }

    // 2. Fallback to x-user-role header for direct header auth / Swagger / testing
    const role = request.headers['x-user-role'] as UserRole;
    if (role) {
      const validRoles = Object.values(UserRole);
      if (!validRoles.includes(role)) {
        throw new UnauthorizedException(
          `Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`,
        );
      }
      request.user = {
        id: 'header-user',
        username: role,
        email: `${role}@nexus.gg`,
        role,
      };
      return true;
    }

    throw new UnauthorizedException(
      'Authentication required. Provide a valid Bearer token in Authorization header or x-user-role header.',
    );
  }
}
