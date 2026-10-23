import path from 'node:path';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { neon } from '@neondatabase/serverless';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env, isPgliteUrl } from '@server/env';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Geradas por `pnpm db:generate`; no Neon são aplicadas por `pnpm db:migrate` (ou no build:vercel)
const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src/server/lib/db/migrations');

let dbPromise: Promise<Db> | null = null;

async function createDb(): Promise<Db> {
  const url = env.DATABASE_URL;
  if (url && !isPgliteUrl(url)) {
    return drizzleNeon(neon(url), { schema });
  }

  // Local e testes: Postgres em memória com as mesmas migrações do Neon
  const db = drizzlePglite(new PGlite(), { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

// Uma instância por processo; chamadas simultâneas na subida compartilham a mesma promessa
export function getDb(): Promise<Db> {
  dbPromise ??= createDb().catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export { schema };
