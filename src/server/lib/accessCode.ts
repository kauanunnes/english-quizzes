import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '@server/env';

// Fora de produção vale um código fixo para o app funcionar sem .env; em produção a variável é obrigatória (ADR-006).
const DEV_ACCESS_CODE = 'segunda-tela-2026';

function expectedAccessCode(): string | undefined {
  // Variável vazia conta como não configurada
  return env.GENERATION_ACCESS_CODE || (env.NODE_ENV === 'production' ? undefined : DEV_ACCESS_CODE);
}

export function isValidAccessCode(candidate: string | null | undefined): boolean {
  const expected = expectedAccessCode();
  if (!expected || !candidate) return false;

  // Compara os hashes para que o tempo não dependa do tamanho nem do conteúdo do código
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
