import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private clients: Map<string, RateLimitRecord> = new Map();
  private readonly maxRequests = 100; // max requests per window
  private readonly windowMs = 60 * 1000; // 1 minute window

  constructor() {
    // Periodic cleanup of stale client records every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of this.clients.entries()) {
        if (now > record.resetTime) {
          this.clients.delete(ip);
        }
      }
    }, 2 * 60 * 1000).unref?.();
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let client = this.clients.get(ip);

    if (!client || now > client.resetTime) {
      client = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.clients.set(ip, client);
    } else {
      client.count++;
    }

    const remaining = Math.max(0, this.maxRequests - client.count);
    const resetSeconds = Math.ceil((client.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (client.count > this.maxRequests) {
      res.setHeader('Retry-After', resetSeconds.toString());
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
          retryAfter: resetSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
