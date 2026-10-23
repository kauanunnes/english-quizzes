import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { neon } from '@neondatabase/serverless';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env } from '@server/env';
import * as schema from './schema';
import { logger } from '@server/lib/logger';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbInstance: Db | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL) {
    try {
      const sql = neon(env.DATABASE_URL);
      dbInstance = drizzleNeon(sql, { schema });
      return dbInstance;
    } catch (err) {
      logger.error('Failed to connect to Neon, falling back to PGlite', {}, err);
    }
  }

  // Local / Test fallback with PGlite
  if (!pgliteInstance) {
    pgliteInstance = new PGlite();
    // Initialize schema tables for PGlite
    await pgliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        episode_key TEXT NOT NULL UNIQUE,
        series_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        document JSONB NOT NULL,
        usage JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS generation_jobs (
        id TEXT PRIMARY KEY,
        episode_key TEXT NOT NULL,
        status TEXT NOT NULL,
        stage TEXT NOT NULL,
        progress JSONB NOT NULL,
        error JSONB,
        heartbeat_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        finished_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS subtitle_selections (
        id TEXT PRIMARY KEY,
        episode_key TEXT NOT NULL,
        strategy TEXT NOT NULL,
        file_id INTEGER,
        file_name TEXT,
        release_name TEXT,
        sha256 TEXT,
        score REAL,
        candidates JSONB,
        accepted BOOLEAN DEFAULT TRUE NOT NULL,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rate_limit_counters (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 1 NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usage_daily (
        date TEXT PRIMARY KEY,
        llm_cost_usd REAL DEFAULT 0 NOT NULL,
        subtitles_downloaded INTEGER DEFAULT 0 NOT NULL,
        quizzes_generated INTEGER DEFAULT 0 NOT NULL
      );

      CREATE TABLE IF NOT EXISTS episodes (
        episode_key TEXT PRIMARY KEY,
        series_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        runtime_minutes INTEGER DEFAULT 22 NOT NULL,
        imdb_id TEXT,
        tmdb_synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
  }

  dbInstance = drizzlePglite(pgliteInstance, { schema });
  return dbInstance;
}

export { schema };
