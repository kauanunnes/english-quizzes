export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  requestId?: string;
  jobId?: string;
  episodeKey?: string;
  stage?: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// LOG_LEVEL (docs/13 §13.2); sem ele, debug só fora de produção
function minimumLevel(): number {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVEL_ORDER) return LEVEL_ORDER[configured];
  return process.env.NODE_ENV === 'production' ? LEVEL_ORDER.info : LEVEL_ORDER.debug;
}

class Logger {
  private enabled(level: LogLevel) {
    return LEVEL_ORDER[level] >= minimumLevel();
  }

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
    if (!this.enabled('info')) return;
    console.log(this.formatLog('info', message, ctx, data));
  }

  warn(message: string, ctx?: LogContext, data?: unknown) {
    if (!this.enabled('warn')) return;
    console.warn(this.formatLog('warn', message, ctx, data));
  }

  error(message: string, ctx?: LogContext, error?: unknown) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(this.formatLog('error', message, ctx, errorDetails));
  }

  debug(message: string, ctx?: LogContext, data?: unknown) {
    if (!this.enabled('debug')) return;
    console.debug(this.formatLog('debug', message, ctx, data));
  }
}

export const logger = new Logger();
