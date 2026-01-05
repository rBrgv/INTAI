/**
 * Structured Logging Utility
 * Provides consistent logging across the application with environment-aware behavior
 */

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as any : undefined,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, log errors, warnings, and info (for debugging API routes)
    if (!this.isDevelopment) {
      return level === 'error' || level === 'warn' || level === 'info';
    }
    // In development, log everything
    return true;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.formatMessage(level, message, context, error);

    // In development, use console methods for better readability
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? console.error
        : level === 'warn' ? console.warn
        : level === 'debug' ? console.debug
        : console.log;

      if (error) {
        consoleMethod(`[${level.toUpperCase()}] ${message}`, context || '', error);
      } else if (context) {
        consoleMethod(`[${level.toUpperCase()}] ${message}`, context);
      } else {
        consoleMethod(`[${level.toUpperCase()}] ${message}`);
      }
    } else {
      // In production, use structured JSON logging
      console.log(JSON.stringify(entry));
    }
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }
}

// Export singleton instance
export const logger = new Logger();

