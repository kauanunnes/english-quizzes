import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getDb, schema } from '@server/lib/db';
import { eq } from 'drizzle-orm';
import { runGenerationJob } from '@server/jobs/jobWorker';
import { isValidAccessCode } from '@server/lib/accessCode';

interface GenerateQuizBody {
  accessCode?: string;
  uploadedSubtitle?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; seasonNumber: string; episodeNumber: string }> }
) {
  const { seriesId, seasonNumber, episodeNumber } = await params;
  const sId = parseInt(seriesId, 10);
  const sNum = parseInt(seasonNumber, 10);
  const eNum = parseInt(episodeNumber, 10);

  const episodeKey = `tmdb-${sId}-s${String(sNum).padStart(2, '0')}-e${String(eNum).padStart(2, '0')}`;
  const db = await getDb();

  const results = await db
    .select()
    .from(schema.quizzes)
    .where(eq(schema.quizzes.episodeKey, episodeKey));

  if (results.length === 0) {
    return NextResponse.json(
      { error: 'QUIZ_NOT_FOUND', message: 'Quiz ainda não foi gerado para este episódio' },
      { status: 404 }
    );
  }

  return NextResponse.json(results[0].document);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; seasonNumber: string; episodeNumber: string }> }
) {
  const { seriesId, seasonNumber, episodeNumber } = await params;
  const sId = parseInt(seriesId, 10);
  const sNum = parseInt(seasonNumber, 10);
  const eNum = parseInt(episodeNumber, 10);

  // 1. Verify access code
  const accessCodeHeader = request.headers.get('X-Access-Code');
  let body: GenerateQuizBody = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const accessCode = accessCodeHeader || body?.accessCode;
  if (!isValidAccessCode(accessCode)) {
    return NextResponse.json(
      { error: 'INVALID_ACCESS_CODE', message: 'Código de acesso inválido ou expirado.' },
      { status: 403 }
    );
  }

  const episodeKey = `tmdb-${sId}-s${String(sNum).padStart(2, '0')}-e${String(eNum).padStart(2, '0')}`;
  const db = await getDb();

  // 2. Check if quiz already exists
  const existingQuizzes = await db
    .select()
    .from(schema.quizzes)
    .where(eq(schema.quizzes.episodeKey, episodeKey));

  if (existingQuizzes.length > 0) {
    return NextResponse.json(existingQuizzes[0].document, { status: 200 });
  }

  // 3. Idempotency: Check if an active job is already running
  const activeJobs = await db
    .select()
    .from(schema.generationJobs)
    .where(eq(schema.generationJobs.episodeKey, episodeKey));

  const runningJob = activeJobs.find(
    (j) => j.status !== 'failed' && j.status !== 'ready'
  );

  if (runningJob) {
    return NextResponse.json({ jobId: runningJob.id, status: runningJob.status }, { status: 202 });
  }

  // 4. Create new job
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await db.insert(schema.generationJobs).values({
    id: jobId,
    episodeKey,
    status: 'queued',
    stage: 'Na fila de processamento...',
    progress: { percentage: 0, message: 'Iniciando o processamento do episódio' },
    createdAt: new Date(),
    updatedAt: new Date(),
    heartbeatAt: new Date(),
  });

  // 5. Schedule background execution with Next.js after()
  const uploadedSubtitle = body?.uploadedSubtitle;

  after(async () => {
    await runGenerationJob({
      jobId,
      seriesId: sId,
      seasonNumber: sNum,
      episodeNumber: eNum,
      uploadedSubtitle,
    });
  });

  return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
}
