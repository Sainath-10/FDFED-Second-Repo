import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileLoggerService } from '../logger/file-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly fileLogger?: FileLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        error = resObj.error || exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    const timestamp = new Date().toISOString();
    const errorResponse = {
      statusCode: status,
      timestamp,
      path: request.url,
      method: request.method,
      error,
      message,
    };

    const stack = exception instanceof Error ? exception.stack : undefined;
    const clientIp = request.ip;
    const userRole = request.headers['x-user-role'] || 'anonymous';

    // Log to file logger error stream
    const errorLogMsg = `[ERROR-HANDLER] ${request.method} ${request.url} - Status: ${status} | Error: ${error} | Msg: ${JSON.stringify(message)}`;

    if (this.fileLogger) {
      this.fileLogger.error(errorLogMsg, stack, 'GlobalExceptionFilter', {
        statusCode: status,
        path: request.url,
        method: request.method,
        clientIp,
        userRole,
      });
    } else {
      console.error(errorLogMsg, stack);
    }

    response.status(status).json(errorResponse);
  }
}
