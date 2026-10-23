// server/lib/retry.ts — backoff exponencial com "full jitter", respeitando Retry-After e o deadline do job
export interface RetryOptions {
  retries: number;
  baseMs: number;
  maxMs: number;
  deadline?: number;
  shouldRetry: (e: unknown) => boolean;
  retryAfterMs?: (e: unknown) => number | undefined;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  o: RetryOptions
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      if (attempt >= o.retries || !o.shouldRetry(e)) throw e;
      const backoff = Math.random() * Math.min(o.maxMs, o.baseMs * 2 ** attempt);
      const wait = Math.max(o.retryAfterMs?.(e) ?? 0, backoff);
      if (o.deadline && Date.now() + wait > o.deadline) throw e;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
