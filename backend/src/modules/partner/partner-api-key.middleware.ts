import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * B2B Middleware — API Key Authentication
 * External partner systems must send: x-api-key: <key>
 * This is the machine-to-machine (B2B) auth pattern,
 * as opposed to the x-user-role header used for B2C consumers.
 */
@Injectable()
export class PartnerApiKeyMiddleware implements NestMiddleware {
  private readonly validKey = process.env.PARTNER_API_KEY || 'fdfed-partner-secret-2026';

  use(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== this.validKey) {
      throw new UnauthorizedException(
        'B2B Access Denied: Valid x-api-key header required for partner API access.',
      );
    }

    // Mark request as B2B authenticated
    res.setHeader('X-Auth-Type', 'B2B-ApiKey');
    next();
  }
}
