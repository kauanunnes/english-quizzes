import { describe, it, expect } from 'vitest';
import { generateQuiz, QualityCheckError, type GenerateQuizContext } from '@server/domain/quiz/generateQuiz';
import { fakeLlmProvider } from '@server/integrations/llm/fake';
import type { LlmProvider } from '@server/integrations/llm/provider';
import { processSubtitle } from '@server/domain/subtitles/pipeline';
import type { Transcript } from '@server/domain/subtitles/types';
import { continuousCues, srt, utf8 } from '../subtitles/helpers';

function transcript(): Transcript {
  const result = processSubtitle(utf8(srt(continuousCues(22 * 60))), { runtimeMin: 22, segmentTargetMin: 5, dropSungLines: true, ocrFix: 'off' });
  if (!result.ok) throw new Error('fixture inválida');
  return result.transcript;
}

function context(provider: LlmProvider = fakeLlmProvider, patch: Partial<GenerateQuizContext> = {}): GenerateQuizContext {
  return {
    jobId: 'job-test',
    episodeKey: 'tmdb-1234-s01-e01',
    tmdbSeriesId: 1234,
    seasonNumber: 1,
    episodeNumber: 1,
    seriesTitle: 'Example Show',
    episodeTitle: 'Pilot',
    provider,
    llm: {
      effort: 'medium',
      thinking: 'adaptive',
      maxTokens: 8000,
      timeoutMs: 120_000,
      concurrency: 4,
      prices: { inPerMTok: 2, outPerMTok: 10, cacheReadPerMTok: 0.1 },
    },
    includePtExplanation: true,
    source: { provider: 'opensubtitles', hearingImpaired: false, release: null },
    ...patch,
  };
}

describe('generateQuiz (§8.1)', () => {
  it('uma chamada por bloco gera um QuizDocument válido com uso e custo registrados', async () => {
    const t = transcript();
    const progress: number[] = [];
    const { document, usage, quality } = await generateQuiz(t, context(fakeLlmProvider, { onSegmentDone: async (done) => void progress.push(done) }));

    expect(document.segments).toHaveLength(t.segments.length);
    expect(document.questions).toHaveLength(8 * t.segments.length);
    expect(usage.llmCalls).toBe(t.segments.length);
    expect(usage.inputTokens).toBe(1200 * t.segments.length);
    // 1.200 tokens × US$ 2 + 800 × US$ 10 por milhão, por bloco
    expect(usage.costUsd).toBeCloseTo(0.0104 * t.segments.length, 4);
    expect(progress.sort()).toEqual(t.segments.map((_, i) => i + 1));
    expect(quality.kept).toBe(document.questions.length);
    expect(document.generation).toMatchObject({ provider: 'fake', model: 'fake-claude', promptVersion: 'quiz-2026-10-v1' });

    // Anti-spoiler: toda evidência cai dentro do próprio bloco
    for (const q of document.questions) {
      const segment = document.segments.find((s) => s.id === q.segmentId)!;
      expect(q.evidence.startMs).toBeGreaterThanOrEqual(segment.startMs);
      expect(q.evidence.endMs).toBeLessThanOrEqual(segment.endMs);
    }
  });

  it('nunca manda à LLM linhas posteriores ao bloco', async () => {
    const t = transcript();
    const seen: string[] = [];
    const spy: LlmProvider = {
      name: 'fake',
      generateJson: (req) => {
        seen.push(req.user);
        return fakeLlmProvider.generateJson(req);
      },
    };
    await generateQuiz(t, context(spy, { llm: { ...context().llm, concurrency: 1 } }));

    for (const [i, segment] of t.segments.entries()) {
      const message = seen.find((m) => m.includes(`<segment id="${segment.id}">`))!;
      const later = t.segments.slice(i + 1).flatMap((s) => s.lineIds);
      for (const id of later) expect(message).not.toContain(`${id}:`);
    }
  });

  it('QUALITY_CHECK_FAILED quando menos de 60% dos blocos têm 2 perguntas válidas', async () => {
    const refusing: LlmProvider = {
      name: 'fake',
      generateJson: async () => ({
        json: null,
        stopReason: 'refusal',
        usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model: 'fake-claude',
        servedByFallback: false,
        latencyMs: 1,
      }),
    };
    await expect(generateQuiz(transcript(), context(refusing))).rejects.toBeInstanceOf(QualityCheckError);
  });
});
