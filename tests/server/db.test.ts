import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from '@server/lib/db';

describe('Database client', () => {
  it('applies the drizzle-kit migrations to the in-memory database', async () => {
    const db = await getDb();
    // O tipo genérico do Db (Neon | PGlite) não conhece o formato do resultado; o PGlite devolve { rows }
    const result = (await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`
    )) as unknown as { rows: { table_name: string }[] };
    const tables = result.rows.map((r) => r.table_name);

    expect(tables).toEqual([
      'episodes',
      'generation_jobs',
      'provider_state',
      'quizzes',
      'rate_limit_counters',
      'subtitle_selections',
      'usage_daily',
    ]);
  });

  it('returns the same instance for concurrent first calls', async () => {
    const [a, b] = await Promise.all([getDb(), getDb()]);
    expect(a).toBe(b);
  });
});
