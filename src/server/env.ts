import { z } from 'zod';

// Variáveis de docs/13 §13.2. O formato é validado ao importar; o que é obrigatório depende do
// ambiente e é checado por assertRuntimeEnv() quando o servidor sobe (src/instrumentation.ts).

// z.coerce.boolean() trataria "false" como true
const flag = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .default(defaultValue);

const base64Secret = (minBytes: number, exactly = false) =>
  z.string().refine(
    (v) => {
      const size = Buffer.from(v, 'base64').length;
      return exactly ? size === minBytes : size >= minBytes;
    },
    `precisa ter ${exactly ? '' : 'pelo menos '}${minBytes} bytes em base64 (gere com: openssl rand -base64 32)`
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),

  // App
  APP_ORIGIN: z.url().optional(),
  APP_VERSION: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  // Banco: Neon (postgres://…) ou PGlite em memória (vazio ou pglite://memory)
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),

  // Upstreams. MOCK_UPSTREAMS=1 usa os dados sintéticos embutidos nos clientes da TMDB e da OpenSubtitles
  MOCK_UPSTREAMS: flag(false),
  TMDB_READ_TOKEN: z.string().optional(),
  OPENSUBTITLES_API_KEY: z.string().optional(),
  OPENSUBTITLES_USERNAME: z.string().optional(),
  OPENSUBTITLES_PASSWORD: z.string().optional(),
  OPENSUBTITLES_USER_AGENT: z.string().default('SegundaTela v0.1.0'),
  OS_MODE: z.enum(['live', 'mock']).default('mock'),
  OS_INTERACTIVE_RESERVE: z.coerce.number().int().min(0).default(5),
  SUBDL_ENABLED: flag(false),
  SUBDL_API_KEY: z.string().optional(),

  // LLM (§4.3.9)
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['anthropic', 'fake']).default('fake'),
  LLM_MODEL: z.string().default('claude-sonnet-5-5'),
  LLM_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  LLM_THINKING: z.enum(['adaptive', 'off']).default('adaptive'),
  LLM_MAX_TOKENS_PER_SEGMENT: z.coerce.number().int().positive().default(8000),
  LLM_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  LLM_PRICE_IN_PER_MTOK: z.coerce.number().min(0).default(2),
  LLM_PRICE_OUT_PER_MTOK: z.coerce.number().min(0).default(10),
  LLM_PRICE_CACHE_READ_PER_MTOK: z.coerce.number().min(0).default(0.1),
  LLM_DAILY_BUDGET_USD: z.coerce.number().min(0).default(1),
  QUIZ_INCLUDE_PT_EXPLANATION: flag(true),

  // Segurança e limites (ADR-006)
  TOKEN_ENCRYPTION_KEY: base64Secret(32, true).optional(),
  ADMIN_TOKEN: base64Secret(32).optional(),
  IP_HASH_SALT: base64Secret(32).optional(),
  GENERATION_ACCESS_CODE: z.string().optional(),
  DAILY_GENERATION_LIMIT: z.coerce.number().int().min(0).default(25),

  // Funcionalidades
  FEATURE_UPLOAD: flag(false),
  FEATURE_REPORTS: flag(true),
  SEGMENT_TARGET_MIN: z.coerce.number().positive().default(5),

  // Observabilidade (§13.8)
  SENTRY_DSN: z.string().optional(),

  // Só na Fase 1 (tracer bullet)
  TRACER_ONLY: flag(false),
  TRACER_SERIES_ID: z.coerce.number().int().positive().optional(),
  TRACER_SEASON: z.coerce.number().int().min(0).optional(),
  TRACER_EPISODE: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // Variável vazia (como as do .env.example) conta como ausente
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(defined);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${issues.join('\n')}`);
  }
  return result.data;
}

export const env = parseEnv();

export function isPgliteUrl(url: string | undefined): boolean {
  return !url || url.startsWith('pglite://');
}

// Regras de obrigatoriedade de §13.2 e §13.4; devolve a lista de problemas (vazia = ok)
export function findEnvProblems(e: Env): string[] {
  const problems: string[] = [];
  const need = (key: keyof Env, when: string) => {
    if (e[key] === undefined) problems.push(`${key} é obrigatória ${when}`);
  };

  if (!e.MOCK_UPSTREAMS) {
    need('TMDB_READ_TOKEN', '(ou defina MOCK_UPSTREAMS=1 para usar dados sintéticos)');
  }

  if (e.OS_MODE === 'live') {
    need('OPENSUBTITLES_API_KEY', 'com OS_MODE=live');
    need('OPENSUBTITLES_USERNAME', 'com OS_MODE=live');
    need('OPENSUBTITLES_PASSWORD', 'com OS_MODE=live');
    if (e.MOCK_UPSTREAMS) problems.push('OS_MODE=live não combina com MOCK_UPSTREAMS=1');
  }

  if (e.LLM_PROVIDER === 'anthropic') need('ANTHROPIC_API_KEY', 'com LLM_PROVIDER=anthropic');

  if (e.NODE_ENV === 'production') {
    const inProduction = 'em produção (next start e deploys)';
    need('APP_ORIGIN', inProduction);
    need('DATABASE_URL', inProduction);
    need('TOKEN_ENCRYPTION_KEY', inProduction);
    need('ADMIN_TOKEN', inProduction);
    need('IP_HASH_SALT', inProduction);
    need('GENERATION_ACCESS_CODE', inProduction);
    if (e.LLM_PROVIDER === 'fake' && !e.MOCK_UPSTREAMS) {
      problems.push('LLM_PROVIDER=fake em produção só é aceito com MOCK_UPSTREAMS=1 (testes E2E)');
    }
  }

  // Deploy de produção da Vercel: nada sintético
  if (e.VERCEL_ENV === 'production') {
    if (e.MOCK_UPSTREAMS) problems.push('MOCK_UPSTREAMS não pode ficar ligado no deploy de produção');
    if (e.OS_MODE !== 'live') problems.push('OS_MODE precisa ser live no deploy de produção');
    if (isPgliteUrl(e.DATABASE_URL)) problems.push('DATABASE_URL precisa apontar para o Neon no deploy de produção');
  }

  return problems;
}

export function assertRuntimeEnv(e: Env = env): void {
  const problems = findEnvProblems(e);
  if (problems.length > 0) {
    throw new Error(
      `O servidor não pode subir. Configure as variáveis (veja .env.example e docs/13 §13.2):\n- ${problems.join('\n- ')}`
    );
  }
}
