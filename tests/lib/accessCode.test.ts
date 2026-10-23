import { describe, it, expect, vi, afterEach } from 'vitest';

// env.ts lê process.env ao ser importado, então cada cenário importa o módulo de novo
async function loadAccessCode(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import('@server/lib/accessCode');
}

describe('isValidAccessCode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts only the configured code', async () => {
    const { isValidAccessCode } = await loadAccessCode({ GENERATION_ACCESS_CODE: 'codigo-de-teste' });

    expect(isValidAccessCode('codigo-de-teste')).toBe(true);
    expect(isValidAccessCode('codigo-errado')).toBe(false);
    expect(isValidAccessCode('')).toBe(false);
    expect(isValidAccessCode(null)).toBe(false);
  });

  it('falls back to the development code outside production', async () => {
    const { isValidAccessCode } = await loadAccessCode({ GENERATION_ACCESS_CODE: '', NODE_ENV: 'development' });

    expect(isValidAccessCode('segunda-tela-2026')).toBe(true);
  });

  it('refuses every code in production when none is configured', async () => {
    const { isValidAccessCode } = await loadAccessCode({ GENERATION_ACCESS_CODE: '', NODE_ENV: 'production' });

    expect(isValidAccessCode('segunda-tela-2026')).toBe(false);
    expect(isValidAccessCode('')).toBe(false);
  });
});
