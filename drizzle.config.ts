import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// O drizzle-kit roda fora do Next: carrega .env.local e .env como o Next faria (o primeiro definido vence)
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/lib/db/schema.ts',
  out: './src/server/lib/db/migrations',
  // Migrações usam a conexão direta do Neon (§13.2); a "pooled" fica para a aplicação
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
  strict: true,
  verbose: true,
});
