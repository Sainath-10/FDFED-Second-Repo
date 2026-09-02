import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FileLoggerService } from '../logger/file-logger.service';

@Injectable()
export class DisputeTrackingMiddleware implements NestMiddleware {
  constructor(private readonly fileLogger: FileLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = 'DSP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    res.setHeader('X-Dispute-Trace-Id', traceId);
    res.setHeader('X-Route-Scope', 'Disputes');

    this.fileLogger.log(
      `[ROUTER-DISPUTES] [Trace: ${traceId}] Processing dispute request: ${req.method} ${req.originalUrl}`,
      'DisputeTracking',
      {
        traceId,
        method: req.method,
        url: req.originalUrl,
      },
    );

    next();
  }
}
