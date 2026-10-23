import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@server/lib/db';
import { env } from '@server/env';
import { runGenerationJob } from '@server/jobs/jobWorker';
import { isValidAccessCode } from '@server/lib/accessCode';
import { newRequestId, problemResponse } from '@server/lib/problem';
import {
  GenerateQuizBodySchema,
  pollAfterMs,
  type GenerateQuizAccepted,
  type GenerateQuizReady,
  type QuizResponse,
} from '@shared/types/generation';

// O job roda em after() dentro desta invocação: até 300 s no plano Hobby (ADR-003, deadline do job em 240 s)
export const maxDuration = 300;

const JOB_DEADLINE_MS = 240_000;

// docs/06 §6.1: faixas dos parâmetros de caminho
const ParamsSchema = z.object({
  seriesId: z.coerce.number().int().min(1).max(2_147_483_647),
  seasonNumber: z.coerce.number().int().min(0).max(200),
  episodeNumber: z.coerce.number().int().min(1).max(5000),
});
type EpisodeParams = z.infer<typeof ParamsSchema>;
type RouteContext = { params: Promise<{ seriesId: string; seasonNumber: string; episodeNumber: string }> };

const pad2 = (n: number) => String(n).padStart(2, '0');
const episodeKeyOf = (p: EpisodeParams) => `tmdb-${p.seriesId}-s${pad2(p.seasonNumber)}-e${pad2(p.episodeNumber)}`;

async function parseParams(context: RouteContext) {
  const parsed = ParamsSchema.safeParse(await context.params);
  return parsed.success ? parsed.data : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = newRequestId();
  const params = await parseParams(context);
  if (!params) return problemResponse(400, 'INVALID_INPUT', { requestId, detail: 'parâmetros do episódio inválidos' });

  const db = await getDb();
  const [row] = await db
    .select({ quiz: schema.quizzes, episode: schema.episodes })
    .from(schema.quizzes)
    .innerJoin(schema.episodes, eq(schema.episodes.episodeKey, schema.quizzes.episodeKey))
    .where(and(eq(schema.quizzes.episodeKey, episodeKeyOf(params)), eq(schema.quizzes.status, 'ready')));

  if (!row) return problemResponse(404, 'QUIZ_NOT_FOUND', { requestId });

  const etag = `"${row.quiz.id}-v${row.quiz.version}"`;
  const headers = { ETag: etag, 'Cache-Control': 'private, max-age=60', 'X-Request-Id': requestId };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  // O documento não carrega nomes da TMDB; eles vêm de `episodes`, que respeita o prazo de 6 meses (§5.5)
  const body: QuizResponse = {
    quizId: row.quiz.id,
    version: row.quiz.version,
    createdAt: row.quiz.createdAt.toISOString(),
    episode: {
      seriesName: row.episode.seriesName,
      episodeName: row.episode.episodeNamePt ?? row.episode.episodeNameEn,
      runtimeMin: row.episode.runtimeMin,
    },
    quiz: row.quiz.payload,
  };
  return NextResponse.json(body, { headers });
}

// docs/06 §6.4 — Fase 1: checagens 1 (corpo), 2 (código de acesso), 3 (quiz pronto), 4 (job ativo) e 10.
// Origin, X-Device-Id, limites e cota (5–9) entram nas Fases 3 e 6.
export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = newRequestId();
  const params = await parseParams(context);
  if (!params) return problemResponse(400, 'INVALID_INPUT', { requestId, detail: 'parâmetros do episódio inválidos' });

  let rawBody: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      rawBody = JSON.parse(text);
    } catch {
      return problemResponse(400, 'INVALID_INPUT', { requestId, detail: 'corpo não é JSON' });
    }
  }
  const body = GenerateQuizBodySchema.safeParse(rawBody);
  if (!body.success) {
    const fields = body.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return problemResponse(400, 'INVALID_INPUT', { requestId, fields });
  }

  // Fase 1 (tracer bullet): só o episódio fixo
  if (
    env.TRACER_ONLY &&
    (params.seriesId !== env.TRACER_SERIES_ID || params.seasonNumber !== env.TRACER_SEASON || params.episodeNumber !== env.TRACER_EPISODE)
  ) {
    return problemResponse(400, 'INVALID_INPUT', { requestId, detail: 'TRACER_ONLY: só o episódio do tracer pode ser gerado' });
  }

  const accessCode = request.headers.get('x-access-code');
  if (!accessCode) return problemResponse(401, 'ACCESS_CODE_REQUIRED', { requestId });
  if (!isValidAccessCode(accessCode)) return problemResponse(401, 'ACCESS_CODE_INVALID', { requestId });

  const episodeKey = episodeKeyOf(params);
  const db = await getDb();

  const [ready] = await db
    .select({ id: schema.quizzes.id, version: schema.quizzes.version })
    .from(schema.quizzes)
    .where(and(eq(schema.quizzes.episodeKey, episodeKey), eq(schema.quizzes.status, 'ready')));
  if (ready) {
    const body: GenerateQuizReady = { status: 'ready', quizId: ready.id, version: ready.version };
    return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
  }

  const accepted = (job: { id: string; status: 'queued' | 'running'; createdAt: Date }) => {
    const body: GenerateQuizAccepted = { status: job.status, jobId: job.id, pollAfterMs: pollAfterMs(job.status, job.createdAt) ?? 2000 };
    return NextResponse.json(body, { status: 202, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
  };

  const findActiveJob = async () => {
    const [job] = await db
      .select({ id: schema.generationJobs.id, status: schema.generationJobs.status, createdAt: schema.generationJobs.createdAt })
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.episodeKey, episodeKey), inArray(schema.generationJobs.status, ['queued', 'running'])));
    return job as { id: string; status: 'queued' | 'running'; createdAt: Date } | undefined;
  };

  const active = await findActiveJob();
  if (active) return accepted(active);

  // 10. Linha mínima em `episodes` e criação idempotente do job (índice único parcial, §5.4)
  await db
    .insert(schema.episodes)
    .values({ episodeKey, tmdbSeriesId: params.seriesId, seasonNumber: params.seasonNumber, episodeNumber: params.episodeNumber })
    .onConflictDoNothing({ target: schema.episodes.episodeKey });

  const [created] = await db
    .insert(schema.generationJobs)
    .values({ episodeKey, source: 'interactive', deadlineAt: new Date(Date.now() + JOB_DEADLINE_MS) })
    .onConflictDoNothing({
      target: schema.generationJobs.episodeKey,
      where: inArray(schema.generationJobs.status, ['queued', 'running']),
    })
    .returning({ id: schema.generationJobs.id, createdAt: schema.generationJobs.createdAt });

  if (!created) {
    // Outro pedido criou o job entre a checagem e o insert
    const raced = await findActiveJob();
    if (raced) return accepted(raced);
    return problemResponse(500, 'INTERNAL', { requestId });
  }

  after(() => runGenerationJob(created.id));
  return accepted({ id: created.id, status: 'queued', createdAt: created.createdAt });
}
