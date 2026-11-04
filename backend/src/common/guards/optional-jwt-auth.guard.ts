import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Resolves the signed-in user when a valid bearer token is present, but keeps
 * the route public for anonymous visitors. Used by read endpoints whose public
 * data must still be withheld from a player removed from that competition.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
