import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { runGenerationJob } from '@server/jobs/jobWorker';
import { getDb, schema } from '@server/lib/db';
import { QuizDocumentSchema } from '@shared/types/quiz';

// Upstreams sintéticos (MOCK_UPSTREAMS=1, LLM fake) e PGlite em memória: vitest.config.mts
async function createJob(seriesId: number, season: number, episode: number) {
  const db = await getDb();
  const episodeKey = `tmdb-${seriesId}-s${String(season).padStart(2, '0')}-e${String(episode).padStart(2, '0')}`;
  await db.insert(schema.episodes).values({ episodeKey, tmdbSeriesId: seriesId, seasonNumber: season, episodeNumber: episode });
  const [job] = await db
    .insert(schema.generationJobs)
    .values({ episodeKey, source: 'interactive', deadlineAt: new Date(Date.now() + 240_000) })
    .returning();
  return { db, episodeKey, jobId: job.id };
}

describe('Generation Job Worker', () => {
  it('roda o pipeline inteiro: job ready, quiz gravado com uso e escolha da legenda registrada', async () => {
    const { db, episodeKey, jobId } = await createJob(31586, 1, 1);

    await runGenerationJob(jobId);

    const [job] = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.id, jobId));
    expect(job).toMatchObject({ status: 'ready', stage: 'ready', progress: 100, errorCode: null });
    expect(job.segmentsDone).toBe(job.segmentsTotal);
    expect(job.finishedAt).not.toBeNull();

    const [quiz] = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, job.quizId!));
    expect(quiz).toMatchObject({ episodeKey, version: 1, status: 'ready', source: 'opensubtitles', provider: 'fake' });
    expect(QuizDocumentSchema.safeParse(quiz.payload).success).toBe(true);
    expect(quiz.questionCount).toBe(quiz.payload.questions.length);
    expect(quiz.segmentCount).toBeGreaterThanOrEqual(3);
    expect(quiz.usage).toMatchObject({ llmCalls: quiz.segmentCount, subtitleDownloads: 1 });

    const [selection] = await db.select().from(schema.subtitleSelections).where(eq(schema.subtitleSelections.jobId, jobId));
    expect(selection).toMatchObject({ accepted: true, strategy: 'parent_tmdb', format: 'srt', encoding: 'utf-8' });
    expect(selection.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(quiz.subtitleSelectionId).toBe(selection.id);

    const [episode] = await db.select().from(schema.episodes).where(eq(schema.episodes.episodeKey, episodeKey));
    expect(episode).toMatchObject({ subtitleStatus: 'found', episodeNameEn: 'Pilot', runtimeMin: 24 });

    const [usage] = await db.select().from(schema.usageDaily);
    expect(usage.generationsReady).toBeGreaterThanOrEqual(1);
    expect(usage.llmCalls).toBeGreaterThanOrEqual(quiz.segmentCount);
  });

  it('ADR-009: a escolha da legenda não guarda falas e o quiz só guarda citações de até 15 palavras', async () => {
    const { db, jobId } = await createJob(31586, 1, 2);
    await runGenerationJob(jobId);

    const [job] = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.id, jobId));
    const [quiz] = await db.select().from(schema.quizzes).where(eq(schema.quizzes.id, job.quizId!));
    const selections = JSON.stringify(await db.select().from(schema.subtitleSelections).where(eq(schema.subtitleSelections.jobId, jobId)));

    // Falas do SRT sintético (modo mock): nenhuma pode estar nos metadados da escolha
    for (const phrase of ['check out this brand new performance', 'pass the showcase', 'coconut milk']) {
      expect(selections).not.toContain(phrase);
    }
    expect(JSON.stringify(quiz)).not.toContain('-->');
    for (const q of quiz.payload.questions) expect(q.evidence.quote.split(/\s+/).length).toBeLessThanOrEqual(15);
  });

  it('falha com código e detalhe sanitizado quando o episódio não existe em episodes', async () => {
    const db = await getDb();
    await db.insert(schema.episodes).values({ episodeKey: 'tmdb-1-s01-e01', tmdbSeriesId: 1, seasonNumber: 1, episodeNumber: 1 });
    const [job] = await db
      .insert(schema.generationJobs)
      .values({ episodeKey: 'tmdb-1-s01-e01', source: 'interactive', deadlineAt: new Date() })
      .returning();
    await db.delete(schema.generationJobs).where(eq(schema.generationJobs.id, job.id));

    await runGenerationJob(job.id); // job inexistente: só registra no log
    const rows = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.id, job.id));
    expect(rows).toEqual([]);
  });
});
