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

// docs/07 §7.13: logs carregam IDs, códigos e números, nunca trechos de texto. Em teste, qualquer
// string com mais de 3 palavras nos campos (não na mensagem fixa) derruba o teste.
const MAX_WORDS_IN_FIELD = 3;

function assertNoFreeText(value: unknown, path: string, depth = 0): void {
  if (depth > 5 || value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (value.trim().split(/\s+/).length > MAX_WORDS_IN_FIELD) {
      throw new Error(`logger: o campo "${path}" tem mais de ${MAX_WORDS_IN_FIELD} palavras; logs não podem carregar texto (docs/07 §7.13)`);
    }
    return;
  }
  if (Array.isArray(value)) value.forEach((item, i) => assertNoFreeText(item, `${path}[${i}]`, depth + 1));
  else if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertNoFreeText(item, `${path}.${key}`, depth + 1);
  }
}

class Logger {
  private enabled(level: LogLevel) {
    return LEVEL_ORDER[level] >= minimumLevel();
  }

  private formatLog(level: LogLevel, message: string, ctx?: LogContext, data?: unknown) {
    if (process.env.NODE_ENV === 'test') {
      assertNoFreeText(ctx, 'ctx');
      // Em error, `data` são os detalhes do Error (mensagem e stack), escritos pelo código
      if (level !== 'error') assertNoFreeText(data, 'data');
    }
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
