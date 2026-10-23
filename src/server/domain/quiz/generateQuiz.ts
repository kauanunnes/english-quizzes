import type { QuizDocument, QuizQuality, QuizUsage } from '@shared/types/quiz';
import llmSegmentOutputSchema from '@shared/schemas/llm-segment-output.schema.json';
import type { LlmProvider, Effort } from '@server/integrations/llm/provider';
import { costUsd } from '@server/integrations/llm/cost';
import { mapWithConcurrency } from '@server/lib/concurrency';
import { renderSegment } from '../subtitles/render';
import type { Transcript } from '../subtitles/types';
import { slotPlanFor } from './slotPlan';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserMessage } from './prompt';
import { validateSegment } from './validate';
import { buildQuizDocument, type SegmentResult } from './postprocess';

// §8.7, regra 5: menos de 60% dos blocos com ≥ 2 perguntas válidas → nada é gravado
const MIN_GOOD_SEGMENT_RATIO = 0.6;
const MIN_QUESTIONS_PER_GOOD_SEGMENT = 2;

export class QualityCheckError extends Error {
  constructor(public goodSegments: number, public totalSegments: number) {
    super(`only ${goodSegments}/${totalSegments} segments have enough valid questions`);
    this.name = 'QualityCheckError';
  }
}

export type GenerateQuizContext = {
  jobId: string;
  episodeKey: string;
  tmdbSeriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  seriesTitle: string | null; // feature_details da OpenSubtitles (§8.4)
  episodeTitle: string | null;
  provider: LlmProvider;
  llm: {
    effort: Effort;
    thinking: 'adaptive' | 'off';
    maxTokens: number;
    timeoutMs: number;
    concurrency: number;
    prices: { inPerMTok: number; outPerMTok: number; cacheReadPerMTok: number };
  };
  includePtExplanation: boolean;
  source: QuizDocument['source'];
  onSegmentDone?: (done: number, total: number) => Promise<void>;
};

export type GeneratedQuiz = { document: QuizDocument; usage: QuizUsage; quality: QuizQuality };

// docs/08 §8.1 — uma chamada por bloco, em paralelo; Fase 1 sem reparo (§8.5 entra na Fase 4)
export async function generateQuiz(transcript: Transcript, ctx: GenerateQuizContext): Promise<GeneratedQuiz> {
  const started = Date.now();
  const usage: QuizUsage = {
    llmCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    subtitleDownloads: 0,
  };
  let model: string | null = null;
  let done = 0;
  const total = transcript.segments.length;

  const results = await mapWithConcurrency(transcript.segments, ctx.llm.concurrency, async (segment): Promise<SegmentResult> => {
    const user = buildUserMessage({
      seriesTitle: ctx.seriesTitle,
      episodeTitle: ctx.episodeTitle,
      seasonNumber: ctx.seasonNumber,
      episodeNumber: ctx.episodeNumber,
      segmentId: segment.id,
      segmentIndex: segment.index,
      segmentTotal: total,
      slots: slotPlanFor(segment.id, segment.index),
      renderedSegment: renderSegment(transcript.lines, transcript.segments, segment.id),
      flags: transcript.flags,
      includePtExplanation: ctx.includePtExplanation,
    });

    const response = await ctx.provider.generateJson({
      system: SYSTEM_PROMPT,
      user,
      schema: llmSegmentOutputSchema,
      maxTokens: ctx.llm.maxTokens,
      effort: ctx.llm.effort,
      thinking: ctx.llm.thinking,
      timeoutMs: ctx.llm.timeoutMs,
      meta: { jobId: ctx.jobId, segmentId: segment.id, attempt: 1 },
    });

    usage.llmCalls++;
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;
    usage.cacheReadTokens += response.usage.cacheReadTokens;
    usage.cacheWriteTokens += response.usage.cacheWriteTokens;
    usage.costUsd += costUsd(response.usage, ctx.llm.prices);
    model ??= response.model;

    const technicalFailure =
      response.stopReason !== 'end_turn'
        ? `LLM_${response.stopReason.toUpperCase()}`
        : response.json === null
          ? 'LLM_INVALID_JSON'
          : null;
    const validation = technicalFailure
      ? { segmentId: segment.id, generated: 0, skipped: 0, valid: [], problems: [] }
      : validateSegment(response.json, segment, transcript.lines);

    await ctx.onSegmentDone?.(++done, total);
    return { segment, validation, technicalFailure };
  });

  const { document, quality } = buildQuizDocument({
    episodeKey: ctx.episodeKey,
    tmdbSeriesId: ctx.tmdbSeriesId,
    seasonNumber: ctx.seasonNumber,
    episodeNumber: ctx.episodeNumber,
    lines: transcript.lines,
    flags: transcript.flags,
    results,
    source: ctx.source,
    generation: {
      provider: ctx.provider.name,
      model: model ?? 'unknown',
      effort: ctx.llm.effort,
      promptVersion: PROMPT_VERSION,
      createdAt: new Date().toISOString(),
    },
    includePtExplanation: ctx.includePtExplanation,
  });

  const goodSegments = document.segments.filter((s) => s.questionIds.length >= MIN_QUESTIONS_PER_GOOD_SEGMENT).length;
  if (goodSegments < Math.ceil(MIN_GOOD_SEGMENT_RATIO * total)) throw new QualityCheckError(goodSegments, total);

  usage.costUsd = Math.round(usage.costUsd * 10_000) / 10_000;
  usage.latencyMs = Date.now() - started;
  return { document, usage, quality };
}
