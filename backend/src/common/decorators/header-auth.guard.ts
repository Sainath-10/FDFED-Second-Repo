import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../interfaces';

/**
 * Header Auth Guard — reads x-user-role from request headers.
 * Sets request.user = { role } for @CurrentUser() and RolesGuard.
 */
@Injectable()
export class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const role = request.headers['x-user-role'] as UserRole;

    if (!role) {
      throw new UnauthorizedException(
        'Missing required header: x-user-role',
      );
    }

    const validRoles = Object.values(UserRole);
    if (!validRoles.includes(role)) {
      throw new UnauthorizedException(
        `Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`,
      );
    }

    request.user = { role };
    return true;
  }
}
