import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FileLoggerService } from '../logger/file-logger.service';

@Injectable()
export class TeamValidationMiddleware implements NestMiddleware {
  constructor(private readonly fileLogger: FileLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Route-Scope', 'Teams');

    if (['POST', 'PATCH'].includes(req.method)) {
      this.fileLogger.log(
        `[ROUTER-TEAMS] Intercepted team mutation: ${req.method} ${req.originalUrl}`,
        'TeamValidation',
        {
          method: req.method,
          url: req.originalUrl,
          bodyKeys: req.body ? Object.keys(req.body) : [],
        },
      );
    }

    next();
  }
}
