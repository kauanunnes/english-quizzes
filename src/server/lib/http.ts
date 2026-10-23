export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown,
    message?: string,
    public retryAfterMs?: number
  ) {
    super(message || `HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
}

export class TimeoutError extends Error {
  constructor(public url: string, public timeoutMs: number) {
    // Só o host: a URL completa pode carregar parâmetros
    super(`Request to ${new URL(url).host} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

// Retry-After em segundos ou como data HTTP
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

// 429, 5xx e timeout podem ser repetidos (docs/04 §4.1.5 e §4.2.9)
export function isRetryableError(e: unknown): boolean {
  if (e instanceof TimeoutError) return true;
  return e instanceof HttpError && (e.status === 429 || e.status >= 500);
}

export function retryAfterOf(e: unknown): number | undefined {
  return e instanceof HttpError ? e.retryAfterMs : undefined;
}

export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15000, ...fetchInit } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    const response = await fetch(url, {
      ...fetchInit,
      signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && controller.signal.aborted) {
      throw new TimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = undefined;
    }
    throw new HttpError(
      response.status,
      response.statusText,
      errorData,
      undefined,
      parseRetryAfter(response.headers.get('retry-after'))
    );
  }

  return response.json() as Promise<T>;
}
