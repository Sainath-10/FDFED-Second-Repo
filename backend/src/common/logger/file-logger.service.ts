import { Injectable, LoggerService, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'LOG' | 'WARN' | 'ERROR' | 'DEBUG' | 'VERBOSE';
  message: string;
  context?: string;
  trace?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class FileLoggerService implements LoggerService, OnModuleDestroy {
  private logBuffer: LogEntry[] = [];
  private errorBuffer: LogEntry[] = [];
  private flushIntervalTimer: NodeJS.Timeout;
  private readonly logsDir = path.resolve(process.cwd(), 'logs');
  private readonly combinedLogPath = path.join(this.logsDir, 'combined.log');
  private readonly appLogPath = path.join(this.logsDir, 'app.log');
  private readonly errorLogPath = path.join(this.logsDir, 'error.log');
  private readonly maxBufferSize = 50;
  private readonly flushIntervalMs = 5000; // Flushes to disk every 5 seconds

  constructor() {
    this.ensureLogsDirectory();
    this.startPeriodicFlush();
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private startPeriodicFlush(): void {
    this.flushIntervalTimer = setInterval(() => {
      this.flushSync();
    }, this.flushIntervalMs);

    // Ensure timer does not prevent process termination
    if (this.flushIntervalTimer.unref) {
      this.flushIntervalTimer.unref();
    }
  }

  private formatEntry(entry: LogEntry): string {
    const contextStr = entry.context ? `[${entry.context}] ` : '';
    const traceStr = entry.trace ? `\nStack: ${entry.trace}` : '';
    const metaStr = entry.metadata ? `\nMeta: ${JSON.stringify(entry.metadata)}` : '';
    return `[${entry.timestamp}] [${entry.level}] ${contextStr}${entry.message}${metaStr}${traceStr}\n`;
  }

  public flushSync(): void {
    try {
      this.ensureLogsDirectory();

      if (this.logBuffer.length > 0) {
        const toWrite = this.logBuffer.splice(0, this.logBuffer.length);
        const content = toWrite.map((e) => this.formatEntry(e)).join('');
        fs.appendFileSync(this.combinedLogPath, content, 'utf8');
        fs.appendFileSync(this.appLogPath, content, 'utf8');
      }

      if (this.errorBuffer.length > 0) {
        const toWriteErrors = this.errorBuffer.splice(0, this.errorBuffer.length);
        const errorContent = toWriteErrors.map((e) => this.formatEntry(e)).join('');
        fs.appendFileSync(this.combinedLogPath, errorContent, 'utf8');
        fs.appendFileSync(this.errorLogPath, errorContent, 'utf8');
      }
    } catch (err) {
      console.error('Failed to flush logs to file:', err);
    }
  }

  private addEntry(entry: LogEntry): void {
    if (entry.level === 'ERROR') {
      this.errorBuffer.push(entry);
    } else {
      this.logBuffer.push(entry);
    }

    if (this.logBuffer.length + this.errorBuffer.length >= this.maxBufferSize) {
      this.flushSync();
    }
  }

  log(message: any, context?: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'LOG',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context,
      metadata,
    };
    console.log(`\x1b[32m[LOG]\x1b[0m ${entry.timestamp} ${context ? `[${context}] ` : ''}${entry.message}`);
    this.addEntry(entry);
  }

  error(message: any, trace?: string, context?: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context,
      trace,
      metadata,
    };
    console.error(`\x1b[31m[ERROR]\x1b[0m ${entry.timestamp} ${context ? `[${context}] ` : ''}${entry.message}`);
    this.addEntry(entry);
  }

  warn(message: any, context?: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context,
      metadata,
    };
    console.warn(`\x1b[33m[WARN]\x1b[0m ${entry.timestamp} ${context ? `[${context}] ` : ''}${entry.message}`);
    this.addEntry(entry);
  }

  debug(message: any, context?: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context,
      metadata,
    };
    console.debug(`\x1b[34m[DEBUG]\x1b[0m ${entry.timestamp} ${context ? `[${context}] ` : ''}${entry.message}`);
    this.addEntry(entry);
  }

  verbose(message: any, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'VERBOSE',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context,
    };
    this.addEntry(entry);
  }

  onModuleDestroy(): void {
    if (this.flushIntervalTimer) {
      clearInterval(this.flushIntervalTimer);
    }
    this.flushSync();
  }
}
