import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const fromRoot = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // tests/e2e é do Playwright
    include: ['tests/**/*.test.ts'],
    // Ambiente de teste (docs/13 §13.4): nada externo, banco em memória
    env: {
      MOCK_UPSTREAMS: '1',
      OS_MODE: 'mock',
      LLM_PROVIDER: 'fake',
      DATABASE_URL: 'pglite://memory',
    },
    coverage: {
      provider: 'v8',
      // Só código: migrações .sql e JSON ficam de fora
      include: ['src/server/**/*.ts', 'src/shared/**/*.ts', 'scripts/**/*.mjs'],
      reporter: ['text-summary', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fromRoot('./src'),
      '@shared': fromRoot('./src/shared'),
      '@server': fromRoot('./src/server'),
    },
  },
});
