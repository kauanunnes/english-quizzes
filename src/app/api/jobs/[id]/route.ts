import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@server/lib/db';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  const results = await db
    .select()
    .from(schema.generationJobs)
    .where(eq(schema.generationJobs.id, id));

  if (results.length === 0) {
    return NextResponse.json({ error: 'JOB_NOT_FOUND', message: 'Job não encontrado' }, { status: 404 });
  }

  const job = results[0];

  // Check stalled job (> 90 seconds without heartbeat on active job)
  const isRunning = job.status !== 'ready' && job.status !== 'failed';
  if (isRunning) {
    const elapsedSeconds = (Date.now() - new Date(job.heartbeatAt).getTime()) / 1000;
    if (elapsedSeconds > 90) {
      await db
        .update(schema.generationJobs)
        .set({
          status: 'failed',
          stage: 'Job interrompido',
          error: {
            code: 'JOB_STALLED',
            message: 'O processamento do job excedeu o tempo limite sem resposta.',
            action: 'Tente gerar novamente.',
          },
          finishedAt: new Date(),
        })
        .where(eq(schema.generationJobs.id, id));

      job.status = 'failed';
      job.error = {
        code: 'JOB_STALLED',
        message: 'O processamento do job excedeu o tempo limite sem resposta.',
        action: 'Tente gerar novamente.',
      };
    }
  }

  return NextResponse.json(job);
}
