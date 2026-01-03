/**
 * Client-Side Logger
 * Provides structured logging for React components and client-side code
 * Only logs in development mode to avoid console noise in production
 */

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

class ClientLogger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors
    if (!this.isDevelopment) {
      return level === 'error';
    }
    // In development, log everything
    return true;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      level,
      message,
      timestamp,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // In development, use console methods for better readability
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? console.error
        : level === 'warn' ? console.warn
        : level === 'debug' ? console.debug
        : console.log;

      const prefix = `[${level.toUpperCase()}]`;
      if (error) {
        consoleMethod(`${prefix} ${message}`, context || '', error);
      } else if (context) {
        consoleMethod(`${prefix} ${message}`, context);
      } else {
        consoleMethod(`${prefix} ${message}`);
      }
    } else {
      // In production, use structured JSON logging (only for errors)
      if (level === 'error') {
        console.error(JSON.stringify(logEntry));
      }
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
export const clientLogger = new ClientLogger();

