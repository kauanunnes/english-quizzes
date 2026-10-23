import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@server/lib/db';
import { newRequestId, problemResponse } from '@server/lib/problem';
import { ERROR_MESSAGES, ErrorCodeSchema } from '@shared/types/errors';
import { pollAfterMs, type JobStatus } from '@shared/types/generation';

// ADR-005: job ativo sem heartbeat há mais de 90 s é marcado como travado na leitura
const STALLED_AFTER_MS = 90_000;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return problemResponse(404, 'JOB_NOT_FOUND', { requestId });

  const db = await getDb();
  const jobs = schema.generationJobs;
  let [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return problemResponse(404, 'JOB_NOT_FOUND', { requestId });

  const active = job.status === 'queued' || job.status === 'running';
  const lastSign = job.heartbeatAt ?? job.createdAt;
  if (active && Date.now() - lastSign.getTime() > STALLED_AFTER_MS) {
    const now = new Date();
    [job] = await db
      .update(jobs)
      .set({ status: 'failed', stage: 'failed', errorCode: 'JOB_STALLED', errorDetail: 'sem heartbeat há mais de 90 s', finishedAt: now })
      .where(eq(jobs.id, id))
      .returning();
  }

  const errorCode = ErrorCodeSchema.safeParse(job.errorCode);
  const body: JobStatus = {
    jobId: job.id,
    episodeKey: job.episodeKey,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    segments: job.segmentsTotal ? { done: job.segmentsDone, total: job.segmentsTotal } : null,
    quizId: job.quizId,
    error: job.status === 'failed' ? { code: errorCode.success ? errorCode.data : 'INTERNAL', message: ERROR_MESSAGES[errorCode.success ? errorCode.data : 'INTERNAL'] } : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: (job.finishedAt ?? job.heartbeatAt ?? job.createdAt).toISOString(),
    pollAfterMs: pollAfterMs(job.status, job.createdAt),
  };

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
}
