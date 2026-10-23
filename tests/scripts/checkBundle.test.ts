import { describe, it, expect } from 'vitest';
import { findSecrets } from '../../scripts/check-bundle.mjs';

describe('check-bundle', () => {
  it('flags well-known secret formats', () => {
    expect(findSecrets('const k="sk-ant-api03-abcdefghijklmnop1234"', {})).toEqual(['chave da Anthropic (sk-ant-)']);
    expect(findSecrets('x="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmn"', {})).toEqual(['token JWT']);
    expect(findSecrets('postgres://user:s3cret@db.neon.tech/neondb', {})).toEqual(['URL de banco com senha']);
    expect(findSecrets('-----BEGIN PRIVATE KEY-----', {})).toEqual(['chave privada PEM']);
  });

  it('flags the value of a configured secret variable without exposing it', () => {
    const findings = findSecrets('fetch("/x", { headers: { a: "minha-frase-secreta" } })', {
      GENERATION_ACCESS_CODE: 'minha-frase-secreta',
    });
    expect(findings).toEqual(['valor de GENERATION_ACCESS_CODE']);
  });

  it('ignores short values, PGlite URLs and ordinary code', () => {
    const findings = findSecrets('const db = "pglite://memory"; const a = "abc"; fetch("/api/health")', {
      DATABASE_URL: 'pglite://memory',
      ADMIN_TOKEN: 'abc',
      TMDB_READ_TOKEN: undefined,
    });
    expect(findings).toEqual([]);
  });
});
