import { randomUUID } from 'node:crypto';
import { ERROR_MESSAGES, type ErrorCode, type Problem } from '@shared/types/errors';

// docs/06 §6.1: erros em application/problem+json (RFC 9457) com code e requestId

export function newRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

const kebab = (code: ErrorCode) => code.toLowerCase().replace(/_/g, '-');

export function problemResponse(
  status: number,
  code: ErrorCode,
  options: { detail?: string; requestId?: string; retryAfterSec?: number; resetAt?: string; fields?: Problem['fields'] } = {}
): Response {
  const requestId = options.requestId ?? newRequestId();
  const body: Problem = {
    type: `https://segunda-tela.app/errors/${kebab(code)}`,
    title: ERROR_MESSAGES[code],
    status,
    code,
    requestId,
    ...(options.detail ? { detail: options.detail } : {}),
    ...(options.retryAfterSec !== undefined ? { retryAfterSec: options.retryAfterSec } : {}),
    ...(options.resetAt ? { resetAt: options.resetAt } : {}),
    ...(options.fields ? { fields: options.fields } : {}),
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/problem+json',
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
  };
  if (options.retryAfterSec !== undefined) headers['Retry-After'] = String(options.retryAfterSec);
  return new Response(JSON.stringify(body), { status, headers });
}
