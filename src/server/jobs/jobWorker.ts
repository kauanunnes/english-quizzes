import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { eq, max, sql } from 'drizzle-orm';
import { getDb, schema, type Db } from '@server/lib/db';
import { env } from '@server/env';
import { logger } from '@server/lib/logger';
import { HttpError, TimeoutError } from '@server/lib/http';
import { tmdbClient } from '@server/integrations/tmdb/client';
import { openSubtitlesClient, type CandidateResult } from '@server/integrations/opensubtitles/client';
import { anthropicProvider } from '@server/integrations/llm/anthropic';
import { fakeLlmProvider } from '@server/integrations/llm/fake';
import type { Effort } from '@server/integrations/llm/provider';
import { processSubtitle } from '@server/domain/subtitles/pipeline';
import { generateQuiz, QualityCheckError } from '@server/domain/quiz/generateQuiz';
import { STAGE_PROGRESS, generatingProgress, type JobStage } from '@shared/types/generation';
import type { ErrorCode } from '@shared/types/errors';
import type { QuizUsage } from '@shared/types/quiz';
import type { CandidateSummary } from '@shared/types/subtitles';

// Falha esperada do pipeline: vira errorCode + errorDetail sanitizado (nunca texto de legenda)
export class JobFailure extends Error {
  constructor(public code: ErrorCode, public detail: string) {
    super(detail);
    this.name = 'JobFailure';
  }
}

function toJobFailure(error: unknown): JobFailure {
  if (error instanceof JobFailure) return error;
  if (error instanceof QualityCheckError) {
    return new JobFailure('QUALITY_CHECK_FAILED', `${error.goodSegments}/${error.totalSegments} blocos com perguntas suficientes`);
  }
  if (error instanceof Anthropic.APIError) {
    const code: ErrorCode = error.status === 401 || error.status === 403 ? 'UPSTREAM_AUTH_FAILED' : 'LLM_FAILED';
    return new JobFailure(code, `LLM ${error.name} ${error.status ?? ''}`.trim());
  }
  if (error instanceof TimeoutError) return new JobFailure('UPSTREAM_TIMEOUT', 'tempo esgotado num serviço externo');
  if (error instanceof HttpError) {
    if (error.status === 406) return new JobFailure('SUBTITLE_QUOTA_EXCEEDED', 'cota diária da OpenSubtitles esgotada');
    if (error.status === 401 || error.status === 403) return new JobFailure('UPSTREAM_AUTH_FAILED', `HTTP ${error.status}`);
    if (error.status === 404) return new JobFailure('EPISODE_NOT_FOUND', 'HTTP 404');
    if (error.status === 429) return new JobFailure('UPSTREAM_RATE_LIMITED', 'HTTP 429');
    if (error.status >= 500) return new JobFailure('UPSTREAM_UNAVAILABLE', `HTTP ${error.status}`);
  }
  return new JobFailure('INTERNAL', error instanceof Error ? error.name : 'erro desconhecido');
}

function summarize(candidates: CandidateResult[]): CandidateSummary[] {
  return candidates.slice(0, 5).map(({ item, score }) => ({
    subtitleId: item.attributes.subtitle_id,
    fileId: item.attributes.files[0]?.file_id ?? null,
    release: item.attributes.release ?? null,
    language: item.attributes.language,
    hearingImpaired: item.attributes.hearing_impaired,
    fromTrusted: item.attributes.from_trusted ?? false,
    downloadCount: item.attributes.download_count,
    uploadDate: item.attributes.upload_date ?? null,
    score,
  }));
}

// Incremento atômico em usage_daily (docs/05 §5.4)
async function recordUsage(db: Db, counts: { ready: number; failed: number; downloads: number; usage: QuizUsage | null }) {
  const day = new Date().toISOString().slice(0, 10);
  const u = counts.usage;
  const t = schema.usageDaily;
  const values = {
    generationsStarted: 1,
    generationsReady: counts.ready,
    generationsFailed: counts.failed,
    subtitleDownloads: counts.downloads,
    llmCalls: u?.llmCalls ?? 0,
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
    cacheReadTokens: u?.cacheReadTokens ?? 0,
    cacheWriteTokens: u?.cacheWriteTokens ?? 0,
    costUsd: String(u?.costUsd ?? 0),
  };
  await db
    .insert(t)
    .values({ day, ...values })
    .onConflictDoUpdate({
      target: t.day,
      set: {
        generationsStarted: sql`${t.generationsStarted} + ${values.generationsStarted}`,
        generationsReady: sql`${t.generationsReady} + ${values.generationsReady}`,
        generationsFailed: sql`${t.generationsFailed} + ${values.generationsFailed}`,
        subtitleDownloads: sql`${t.subtitleDownloads} + ${values.subtitleDownloads}`,
        llmCalls: sql`${t.llmCalls} + ${values.llmCalls}`,
        inputTokens: sql`${t.inputTokens} + ${values.inputTokens}`,
        outputTokens: sql`${t.outputTokens} + ${values.outputTokens}`,
        cacheReadTokens: sql`${t.cacheReadTokens} + ${values.cacheReadTokens}`,
        cacheWriteTokens: sql`${t.cacheWriteTokens} + ${values.cacheWriteTokens}`,
        costUsd: sql`${t.costUsd} + ${values.costUsd}`,
      },
    });
}

// docs/03 §3.4 e docs/06 §6.6 — roda dentro de after() na mesma invocação do POST
export async function runGenerationJob(jobId: string): Promise<void> {
  const db = await getDb();
  const [job] = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.id, jobId));
  if (!job) {
    logger.error('Generation job not found', { jobId });
    return;
  }
  const ctx = { jobId, episodeKey: job.episodeKey };
  const jobs = schema.generationJobs;
  let downloads = 0;
  let usage: QuizUsage | null = null;

  const setStage = (stage: Exclude<JobStage, 'generating' | 'failed'>, extra: Partial<typeof jobs.$inferInsert> = {}) =>
    db
      .update(jobs)
      .set({ status: 'running', stage, progress: STAGE_PROGRESS[stage], heartbeatAt: new Date(), ...extra })
      .where(eq(jobs.id, jobId));

  try {
    logger.info('Generation job started', ctx);
    await setStage('resolving', { startedAt: new Date() });

    const [episode] = await db.select().from(schema.episodes).where(eq(schema.episodes.episodeKey, job.episodeKey));
    if (!episode) throw new JobFailure('INTERNAL', 'episódio sem linha em episodes');
    const { tmdbSeriesId: seriesId, seasonNumber, episodeNumber } = episode;

    // 1. TMDB: título EN (valida a legenda), duração (QA) e IDs externos
    const [series, ep] = await Promise.all([
      tmdbClient.getSeriesDetails(seriesId),
      tmdbClient.getEpisodeDetailsEn(seriesId, seasonNumber, episodeNumber),
    ]);
    await db
      .update(schema.episodes)
      .set({
        tmdbEpisodeId: ep.id,
        imdbEpisodeId: ep.imdbId,
        imdbSeriesId: series.imdbId ?? null,
        seriesName: series.name,
        episodeNameEn: ep.name,
        runtimeMin: ep.runtime,
        originalLanguage: series.originalLanguage,
        tmdbSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.episodes.episodeKey, job.episodeKey));

    // 2. Busca (não gasta cota)
    await setStage('searching');
    const { candidates, strategy } = await openSubtitlesClient.findBestCandidates({
      seriesId,
      seriesTitle: series.originalName || series.name,
      seasonNumber,
      episodeNumber,
      episodeTitleEn: ep.name,
      seriesImdbId: series.imdbId,
      episodeImdbId: ep.imdbId,
    });
    await db
      .update(schema.episodes)
      .set({ subtitleStatus: candidates.length ? 'found' : 'not_found', subtitleCheckedAt: new Date() })
      .where(eq(schema.episodes.episodeKey, job.episodeKey));
    if (!candidates.length || !strategy) throw new JobFailure('SUBTITLE_NOT_FOUND', 'nenhuma legenda EN aprovada nos filtros');

    // 3. Download (consome 1 da cota). Fase 1: só o 1º candidato; o 2º entra na Fase 3
    const top = candidates[0];
    const attrs = top.item.attributes;
    const fileId = attrs.files[0]?.file_id;
    await setStage('downloading');
    const downloaded = await openSubtitlesClient.downloadSubtitle(fileId);
    downloads++;
    logger.info('Subtitle downloaded', { ...ctx, strategy, bytes: downloaded.bytes.length, quotaRemaining: downloaded.remaining });

    // 4. Pipeline do item 7, só em memória
    await setStage('parsing');
    const parsed = processSubtitle(downloaded.bytes, {
      runtimeMin: ep.runtime,
      segmentTargetMin: env.SEGMENT_TARGET_MIN,
      dropSungLines: true,
      ocrFix: 'auto',
    });
    const [selection] = await db
      .insert(schema.subtitleSelections)
      .values({
        episodeKey: job.episodeKey,
        jobId,
        provider: 'opensubtitles',
        strategy,
        providerSubtitleId: attrs.subtitle_id,
        providerFileId: String(fileId),
        release: attrs.release ?? null,
        language: attrs.language,
        hearingImpaired: attrs.hearing_impaired,
        fromTrusted: attrs.from_trusted ?? null,
        downloadCount: attrs.download_count,
        ratings: attrs.ratings,
        votes: attrs.votes,
        uploadDate: attrs.upload_date ? new Date(attrs.upload_date) : null,
        score: top.score,
        candidates: summarize(candidates),
        fileSha256: createHash('sha256').update(downloaded.bytes).digest('hex'),
        fileBytes: downloaded.bytes.length,
        encoding: parsed.ok ? parsed.transcript.encoding : null,
        format: parsed.ok ? parsed.transcript.format : null,
        parserStats: parsed.ok ? parsed.transcript.stats : null,
        qa: parsed.qa ?? null,
        accepted: parsed.ok,
        rejectionReason: parsed.ok ? null : [parsed.error.code, parsed.error.gate].filter(Boolean).join(':'),
      })
      .returning({ id: schema.subtitleSelections.id });

    if (!parsed.ok) {
      const code: ErrorCode = parsed.error.code === 'UNSUPPORTED_SUBTITLE_FORMAT' ? 'UNSUPPORTED_SUBTITLE_FORMAT' : 'SUBTITLE_UNUSABLE';
      throw new JobFailure(code, parsed.error.detail);
    }
    const { transcript } = parsed;
    logger.info('Subtitle parsed', {
      ...ctx,
      encoding: transcript.encoding,
      cuesIn: transcript.stats.cuesIn,
      linesOut: transcript.stats.linesOut,
      durationMs: transcript.stats.durationMs,
      segments: transcript.segments.length,
      dropped: transcript.stats.dropped,
    });

    // 5. Uma chamada à LLM por bloco
    const total = transcript.segments.length;
    await db
      .update(jobs)
      .set({ stage: 'generating', progress: generatingProgress(0, total), segmentsDone: 0, segmentsTotal: total, heartbeatAt: new Date() })
      .where(eq(jobs.id, jobId));

    const generated = await generateQuiz(transcript, {
      jobId,
      episodeKey: job.episodeKey,
      tmdbSeriesId: seriesId,
      seasonNumber,
      episodeNumber,
      seriesTitle: attrs.feature_details?.parent_title ?? null,
      episodeTitle: attrs.feature_details?.title ?? null,
      provider: env.LLM_PROVIDER === 'anthropic' ? anthropicProvider : fakeLlmProvider,
      llm: {
        effort: env.LLM_EFFORT as Effort,
        thinking: env.LLM_THINKING,
        maxTokens: env.LLM_MAX_TOKENS_PER_SEGMENT,
        timeoutMs: env.LLM_TIMEOUT_MS,
        concurrency: env.LLM_MAX_CONCURRENCY,
        prices: {
          inPerMTok: env.LLM_PRICE_IN_PER_MTOK,
          outPerMTok: env.LLM_PRICE_OUT_PER_MTOK,
          cacheReadPerMTok: env.LLM_PRICE_CACHE_READ_PER_MTOK,
        },
      },
      includePtExplanation: env.QUIZ_INCLUDE_PT_EXPLANATION,
      source: { provider: 'opensubtitles', hearingImpaired: attrs.hearing_impaired ?? null, release: attrs.release ?? null },
      onSegmentDone: async (done, segmentsTotal) => {
        await db
          .update(jobs)
          .set({ progress: generatingProgress(done, segmentsTotal), segmentsDone: done, heartbeatAt: new Date() })
          .where(eq(jobs.id, jobId));
      },
    });
    usage = { ...generated.usage, subtitleDownloads: downloads };

    // 6. Gravar a nova versão do quiz
    await setStage('validating');
    const [{ lastVersion }] = await db
      .select({ lastVersion: max(schema.quizzes.version) })
      .from(schema.quizzes)
      .where(eq(schema.quizzes.episodeKey, job.episodeKey));
    const { document, quality } = generated;
    const [quiz] = await db
      .insert(schema.quizzes)
      .values({
        episodeKey: job.episodeKey,
        version: (lastVersion ?? 0) + 1,
        status: 'ready',
        schemaVersion: document.schemaVersion,
        promptVersion: document.generation.promptVersion,
        provider: document.generation.provider,
        model: document.generation.model,
        effort: document.generation.effort,
        source: 'opensubtitles',
        subtitleSelectionId: selection.id,
        segmentCount: document.segments.length,
        questionCount: document.questions.length,
        payload: document,
        usage,
        quality,
      })
      .returning({ id: schema.quizzes.id });

    const now = new Date();
    await db
      .update(jobs)
      .set({ status: 'ready', stage: 'ready', progress: 100, quizId: quiz.id, heartbeatAt: now, finishedAt: now })
      .where(eq(jobs.id, jobId));
    await recordUsage(db, { ready: 1, failed: 0, downloads, usage });

    logger.info('Generation job ready', {
      ...ctx,
      quizId: quiz.id,
      segments: document.segments.length,
      questions: document.questions.length,
      dropped: quality.droppedByRule,
      llmCalls: usage.llmCalls,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
      latencyMs: usage.latencyMs,
    });
  } catch (error) {
    const failure = toJobFailure(error);
    logger.warn('Generation job failed', { ...ctx, code: failure.code });
    const now = new Date();
    await db
      .update(jobs)
      .set({ status: 'failed', stage: 'failed', errorCode: failure.code, errorDetail: failure.detail, heartbeatAt: now, finishedAt: now })
      .where(eq(jobs.id, jobId));
    await recordUsage(db, { ready: 0, failed: 1, downloads, usage }).catch(() => undefined);
  }
}
