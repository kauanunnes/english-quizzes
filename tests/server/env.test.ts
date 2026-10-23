import { describe, it, expect } from 'vitest';
import { parseEnv, findEnvProblems } from '@server/env';

const SECRET = Buffer.alloc(32, 7).toString('base64');

const productionBase = {
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://segunda-tela.example',
  DATABASE_URL: 'postgres://user:pass@db.example/neondb',
  TMDB_READ_TOKEN: 'tmdb-token',
  LLM_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'chave-de-teste',
  TOKEN_ENCRYPTION_KEY: SECRET,
  ADMIN_TOKEN: SECRET,
  IP_HASH_SALT: SECRET,
  GENERATION_ACCESS_CODE: 'frase-longa-de-teste',
};

describe('parseEnv', () => {
  it('treats empty values as missing, like a copied .env.example', () => {
    const e = parseEnv({ TMDB_READ_TOKEN: '', ADMIN_TOKEN: '', LLM_PROVIDER: '' });
    expect(e.TMDB_READ_TOKEN).toBeUndefined();
    expect(e.ADMIN_TOKEN).toBeUndefined();
    expect(e.LLM_PROVIDER).toBe('fake');
  });

  it('parses boolean flags without turning "false" into true', () => {
    expect(parseEnv({ QUIZ_INCLUDE_PT_EXPLANATION: 'false' }).QUIZ_INCLUDE_PT_EXPLANATION).toBe(false);
    expect(parseEnv({ MOCK_UPSTREAMS: '1' }).MOCK_UPSTREAMS).toBe(true);
    expect(parseEnv({}).FEATURE_REPORTS).toBe(true);
  });

  it('rejects malformed values with the variable name', () => {
    expect(() => parseEnv({ TOKEN_ENCRYPTION_KEY: 'curta' })).toThrow(/TOKEN_ENCRYPTION_KEY/);
    expect(() => parseEnv({ LLM_EFFORT: 'maximum' })).toThrow(/LLM_EFFORT/);
    expect(() => parseEnv({ APP_ORIGIN: 'not a url' })).toThrow(/APP_ORIGIN/);
  });
});

describe('findEnvProblems', () => {
  it('accepts local development with synthetic upstreams and no keys', () => {
    expect(findEnvProblems(parseEnv({ NODE_ENV: 'development', MOCK_UPSTREAMS: '1' }))).toEqual([]);
  });

  it('requires the TMDB token unless upstreams are mocked', () => {
    const problems = findEnvProblems(parseEnv({ NODE_ENV: 'development' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/TMDB_READ_TOKEN/);
  });

  it('requires OpenSubtitles credentials only in live mode', () => {
    const problems = findEnvProblems(parseEnv({ MOCK_UPSTREAMS: '0', TMDB_READ_TOKEN: 't', OS_MODE: 'live' }));
    expect(problems.join('\n')).toMatch(/OPENSUBTITLES_API_KEY/);
    expect(problems.join('\n')).toMatch(/OPENSUBTITLES_PASSWORD/);
  });

  it('requires the Anthropic key when the real provider is selected', () => {
    const problems = findEnvProblems(parseEnv({ MOCK_UPSTREAMS: '1', LLM_PROVIDER: 'anthropic' }));
    expect(problems).toEqual([expect.stringMatching(/ANTHROPIC_API_KEY/)]);
  });

  it('accepts a complete production configuration', () => {
    expect(findEnvProblems(parseEnv(productionBase))).toEqual([]);
  });

  it('lists every missing production secret', () => {
    const problems = findEnvProblems(parseEnv({ NODE_ENV: 'production', MOCK_UPSTREAMS: '1' })).join('\n');
    for (const key of ['APP_ORIGIN', 'DATABASE_URL', 'TOKEN_ENCRYPTION_KEY', 'ADMIN_TOKEN', 'IP_HASH_SALT', 'GENERATION_ACCESS_CODE']) {
      expect(problems).toContain(key);
    }
  });

  it('refuses the fake LLM in production unless running E2E with mocks', () => {
    const real = findEnvProblems(parseEnv({ ...productionBase, LLM_PROVIDER: 'fake' }));
    expect(real.join('\n')).toMatch(/LLM_PROVIDER=fake/);

    const e2e = findEnvProblems(parseEnv({ ...productionBase, LLM_PROVIDER: 'fake', MOCK_UPSTREAMS: '1', DATABASE_URL: 'pglite://memory' }));
    expect(e2e).toEqual([]);
  });

  it('forbids anything synthetic on the Vercel production deploy', () => {
    const problems = findEnvProblems(
      parseEnv({ ...productionBase, VERCEL_ENV: 'production', MOCK_UPSTREAMS: '1', DATABASE_URL: 'pglite://memory' })
    ).join('\n');
    expect(problems).toMatch(/MOCK_UPSTREAMS/);
    expect(problems).toMatch(/OS_MODE/);
    expect(problems).toMatch(/DATABASE_URL/);
  });
});
