import { defineConfig, devices } from '@playwright/test';

// Porta própria para não colidir com o `pnpm dev` aberto na 3000
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

// Segredos de mentira: `next start` roda em modo produção e exige as variáveis de produção (§13.2)
const fakeSecret = Buffer.alloc(32, 1).toString('base64');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium-pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-iphone-14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    // No CI o build já rodou num passo anterior; localmente, builda antes de subir
    command: isCI ? `pnpm start --port ${PORT}` : `pnpm build && pnpm start --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    env: {
      MOCK_UPSTREAMS: '1',
      OS_MODE: 'mock',
      LLM_PROVIDER: 'fake',
      DATABASE_URL: 'pglite://memory',
      APP_ORIGIN: BASE_URL,
      TOKEN_ENCRYPTION_KEY: fakeSecret,
      ADMIN_TOKEN: fakeSecret,
      IP_HASH_SALT: fakeSecret,
      GENERATION_ACCESS_CODE: 'e2e-access-code',
    },
  },
});
