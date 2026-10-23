import { QuizDocument, QuizSegment, Question } from '@shared/types/quiz';
import { SubtitleSegment } from '../subtitles/types';
import { LlmProvider } from '@server/integrations/llm/provider';
import { anthropicProvider } from '@server/integrations/llm/anthropic';
import { fakeLlmProvider } from '@server/integrations/llm/fake';
import { costUsd } from '@server/integrations/llm/cost';
import { buildSystemPrompt, buildUserPrompt, QUIZ_SEGMENT_JSON_SCHEMA } from './prompt';
import { validateAndEnrichSegmentQuestions } from './validator';
import { env } from '@server/env';
import { logger } from '@server/lib/logger';

export interface GenerateQuizOptions {
  jobId: string;
  seriesId: number;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  runtimeMinutes: number;
  segments: SubtitleSegment[];
  onProgress?: (completedSegments: number, totalSegments: number) => Promise<void>;
  provider?: LlmProvider;
}

function extractRawQuestions(json: unknown): unknown[] {
  if (!json || typeof json !== 'object') return [];
  const questions = (json as { questions?: unknown }).questions;
  return Array.isArray(questions) ? questions : [];
}

export async function generateQuizForEpisode(options: GenerateQuizOptions): Promise<QuizDocument> {
  const {
    jobId,
    seriesId,
    seriesTitle,
    seasonNumber,
    episodeNumber,
    episodeTitle,
    runtimeMinutes,
    segments,
    onProgress,
  } = options;

  const episodeKey = `tmdb-${seriesId}-s${String(seasonNumber).padStart(2, '0')}-e${String(episodeNumber).padStart(2, '0')}`;
  const provider = options.provider || (env.LLM_PROVIDER === 'anthropic' ? anthropicProvider : fakeLlmProvider);

  logger.info('Starting quiz generation for episode', { jobId, episodeKey, segmentsCount: segments.length });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  const quizSegments: QuizSegment[] = [];
  const systemPrompt = buildSystemPrompt(seriesTitle, episodeTitle);

  // Process segments with concurrency control
  const maxConcurrency = env.LLM_MAX_CONCURRENCY;
  let completedCount = 0;

  for (let i = 0; i < segments.length; i += maxConcurrency) {
    const chunk = segments.slice(i, i + maxConcurrency);

    const chunkPromises = chunk.map(async (segment) => {
      let attempt = 1;
      let finalQuestions: Question[] = [];

      while (attempt <= 2) {
        const userPrompt = buildUserPrompt(segment);

        const llmResult = await provider.generateJson({
          system: systemPrompt,
          user: userPrompt,
          schema: QUIZ_SEGMENT_JSON_SCHEMA,
          maxTokens: env.LLM_MAX_TOKENS_PER_SEGMENT,
          effort: env.LLM_EFFORT,
          thinking: env.LLM_THINKING,
          timeoutMs: env.LLM_TIMEOUT_MS,
          meta: { jobId, segmentId: segment.id, attempt },
        });

        totalInputTokens += llmResult.usage.inputTokens;
        totalOutputTokens += llmResult.usage.outputTokens;
        totalCostUsd += costUsd(llmResult.usage, {
          inPerMTok: env.LLM_PRICE_IN_PER_MTOK,
          outPerMTok: env.LLM_PRICE_OUT_PER_MTOK,
          cacheReadPerMTok: env.LLM_PRICE_CACHE_READ_PER_MTOK,
        });

        const rawQuestions = extractRawQuestions(llmResult.json);
        const validation = validateAndEnrichSegmentQuestions(rawQuestions, segment);

        if (validation.validQuestions.length >= 6 || attempt === 2) {
          finalQuestions = validation.validQuestions;
          break;
        }

        // Try once more if too many questions failed
        logger.warn('Segment question quality below target, retrying once', {
          jobId,
          segmentId: segment.id,
          attempt,
          validCount: validation.validQuestions.length,
        });
        attempt++;
      }

      completedCount++;
      if (onProgress) {
        await onProgress(completedCount, segments.length);
      }

      return {
        id: segment.id,
        index: segment.index,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        formattedStart: segment.formattedStart,
        formattedEnd: segment.formattedEnd,
        label: `Bloco ${segment.index} · ${segment.formattedStart}–${segment.formattedEnd}`,
        questions: finalQuestions,
      };
    });

    const chunkResults = await Promise.all(chunkPromises);
    quizSegments.push(...chunkResults);
  }

  // Sort segments by index
  quizSegments.sort((a, b) => a.index - b.index);

  const totalQuestions = quizSegments.reduce((sum, s) => sum + s.questions.length, 0);

  // Quality check: ensure we generated questions
  if (totalQuestions === 0) {
    throw new Error('QUALITY_CHECK_FAILED: Zero valid questions generated for episode');
  }

  return {
    episodeKey,
    seriesId,
    seriesTitle,
    seasonNumber,
    episodeNumber,
    episodeTitle,
    runtimeMinutes,
    segments: quizSegments,
    totalQuestions,
    createdAt: new Date().toISOString(),
    source: options.provider?.name === 'fake' ? 'mock' : 'opensubtitles',
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd: Math.round(totalCostUsd * 1000) / 1000,
    },
  };
}
