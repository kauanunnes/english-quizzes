import { describe, it, expect } from 'vitest';
import { runGenerationJob } from '@server/jobs/jobWorker';
import { getDb, schema } from '@server/lib/db';
import { eq } from 'drizzle-orm';

describe('Generation Job Worker', () => {
  it('runs the full generation pipeline and sets job to ready with quiz saved', async () => {
    const db = await getDb();
    const jobId = `job_test_${Date.now()}`;
    const episodeKey = 'tmdb-31586-s01-e01';

    // Insert initial queued job
    await db.insert(schema.generationJobs).values({
      id: jobId,
      episodeKey,
      status: 'queued',
      stage: 'Na fila',
      progress: { percentage: 0, message: 'Aguardando início' },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeatAt: new Date(),
    });

    // Run the job runner
    await runGenerationJob({
      jobId,
      seriesId: 31586,
      seasonNumber: 1,
      episodeNumber: 1,
    });

    // Verify job status
    const jobs = await db
      .select()
      .from(schema.generationJobs)
      .where(eq(schema.generationJobs.id, jobId));

    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('ready');
    expect(jobs[0].progress.percentage).toBe(100);

    // Verify quiz was created
    const savedQuizzes = await db
      .select()
      .from(schema.quizzes)
      .where(eq(schema.quizzes.episodeKey, episodeKey));

    expect(savedQuizzes.length).toBeGreaterThan(0);
    const quizDoc = savedQuizzes[0].document;
    expect(quizDoc.episodeKey).toBe(episodeKey);
    expect(quizDoc.segments.length).toBeGreaterThan(0);
    expect(quizDoc.totalQuestions).toBeGreaterThan(0);
  });
});
