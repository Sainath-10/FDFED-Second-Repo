import {
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * HeaderAuthGuard (Deprecated / Secure Compatibility):
 * Enforces JWT authentication to prevent header spoofing.
 */
@Injectable()
export class HeaderAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return (await super.canActivate(context)) as boolean;
  }
}

