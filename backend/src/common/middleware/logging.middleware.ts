import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FileLoggerService } from '../logger/file-logger.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly fileLogger: FileLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'Unknown Agent';
    const userRole = headers['x-user-role'] || 'anonymous';

    // Log request start
    this.fileLogger.log(
      `--> [REQ] ${method} ${originalUrl} | Client IP: ${ip} | Role: ${userRole}`,
      'HTTP',
      {
        method,
        url: originalUrl,
        ip,
        userRole,
        userAgent,
      },
    );

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '0';

      const logMsg = `<-- [RES] ${method} ${originalUrl} ${statusCode} [${duration}ms] - Length: ${contentLength}b`;

      if (statusCode >= 500) {
        this.fileLogger.error(logMsg, undefined, 'HTTP', {
          method,
          url: originalUrl,
          statusCode,
          duration,
        });
      } else if (statusCode >= 400) {
        this.fileLogger.warn(logMsg, 'HTTP', {
          method,
          url: originalUrl,
          statusCode,
          duration,
        });
      } else {
        this.fileLogger.log(logMsg, 'HTTP', {
          method,
          url: originalUrl,
          statusCode,
          duration,
        });
      }
    });

    next();
  }
}
