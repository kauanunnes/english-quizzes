import { describe, it, expect, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { logger } from '@server/lib/logger';
import { getDb, schema } from '@server/lib/db';
import { runGenerationJob } from '@server/jobs/jobWorker';

describe('Logger em modo de teste (docs/07 §7.13)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('falha se um campo carregar mais de 3 palavras', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => logger.info('Subtitle parsed', { jobId: 'j1', line: 'We should really rehearse now' })).toThrow(/line/);
    expect(() => logger.warn('Step', {}, { nested: { text: 'one two three four' } })).toThrow(/data\.nested\.text/);
  });

  it('aceita IDs, códigos, números e textos curtos', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => logger.info('Subtitle parsed', { jobId: 'j1', code: 'SUBTITLE_UNUSABLE', linesOut: 412, stage: 'parsing' })).not.toThrow();
  });

  it('um job inteiro (modo mock) não loga nenhuma fala da legenda', async () => {
    const output: string[] = [];
    for (const method of ['log', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((line: string) => void output.push(line));
    }

    const db = await getDb();
    const episodeKey = 'tmdb-777-s01-e01';
    await db.insert(schema.episodes).values({ episodeKey, tmdbSeriesId: 777, seasonNumber: 1, episodeNumber: 1 });
    const [job] = await db
      .insert(schema.generationJobs)
      .values({ episodeKey, source: 'interactive', deadlineAt: new Date(Date.now() + 240_000) })
      .returning();
    await runGenerationJob(job.id);

    const [done] = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.id, job.id));
    expect(done.status).toBe('ready'); // um log com texto teria derrubado o job
    expect(output.length).toBeGreaterThan(0);
    const logs = output.join('\n');
    for (const phrase of ['brand new performance', 'coconut milk', 'Make it shine']) expect(logs).not.toContain(phrase);
  });
});
