export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  requestId?: string;
  jobId?: string;
  episodeKey?: string;
  stage?: string;
  [key: string]: unknown;
}

class Logger {
  private formatLog(level: LogLevel, message: string, ctx?: LogContext, data?: unknown) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(ctx || {}),
      ...(data !== undefined ? { data } : {}),
    });
  }

  info(message: string, ctx?: LogContext, data?: unknown) {
    console.log(this.formatLog('info', message, ctx, data));
  }

  warn(message: string, ctx?: LogContext, data?: unknown) {
    console.warn(this.formatLog('warn', message, ctx, data));
  }

  error(message: string, ctx?: LogContext, error?: unknown) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(this.formatLog('error', message, ctx, errorDetails));
  }

  debug(message: string, ctx?: LogContext, data?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, ctx, data));
    }
  }
}

export const logger = new Logger();
