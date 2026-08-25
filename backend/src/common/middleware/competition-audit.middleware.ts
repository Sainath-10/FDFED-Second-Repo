import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FileLoggerService } from '../logger/file-logger.service';

@Injectable()
export class CompetitionAuditMiddleware implements NestMiddleware {
  constructor(private readonly fileLogger: FileLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const userRole = req.headers['x-user-role'] || 'anonymous';
    const clientIp = req.ip || req.socket.remoteAddress;

    res.setHeader('X-Audit-Module', 'Competitions');

    // If mutating action, log dedicated audit event
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      this.fileLogger.log(
        `[AUDIT-COMPETITIONS] Mutation initiated: ${req.method} ${req.originalUrl} by Role [${userRole}] from [${clientIp}]`,
        'CompetitionAudit',
        {
          method: req.method,
          url: req.originalUrl,
          userRole,
          body: req.body,
        },
      );
    }

    next();
  }
}
