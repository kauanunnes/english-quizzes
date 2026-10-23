import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TMDB_READ_TOKEN: z.string().optional(),
  OPENSUBTITLES_API_KEY: z.string().optional(),
  OPENSUBTITLES_USERNAME: z.string().optional(),
  OPENSUBTITLES_PASSWORD: z.string().optional(),
  OPENSUBTITLES_USER_AGENT: z.string().default('SegundaTela v0.1.0'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['anthropic', 'fake']).default('fake'),
  LLM_MODEL: z.string().default('claude-sonnet-5-5'),
  LLM_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  LLM_THINKING: z.enum(['adaptive', 'off']).default('adaptive'),
  LLM_MAX_TOKENS_PER_SEGMENT: z.coerce.number().default(8000),
  LLM_MAX_CONCURRENCY: z.coerce.number().default(4),
  LLM_TIMEOUT_MS: z.coerce.number().default(120000),
  LLM_PRICE_IN_PER_MTOK: z.coerce.number().default(2),
  LLM_PRICE_OUT_PER_MTOK: z.coerce.number().default(10),
  LLM_PRICE_CACHE_READ_PER_MTOK: z.coerce.number().default(0.10),
  LLM_DAILY_BUDGET_USD: z.coerce.number().default(1.00),
  DAILY_GENERATION_LIMIT: z.coerce.number().default(25),
  GENERATION_ACCESS_CODE: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().default('dev-key-must-be-32-chars-long-!!'),
  DATABASE_URL: z.string().optional(),
  SEGMENT_TARGET_MIN: z.coerce.number().default(5),
  OS_INTERACTIVE_RESERVE: z.coerce.number().default(5),
  QUIZ_INCLUDE_PT_EXPLANATION: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    return envSchema.parse({});
  }
  return result.data;
}

export const env = parseEnv();
