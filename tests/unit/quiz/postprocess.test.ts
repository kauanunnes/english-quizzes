import { describe, it, expect } from 'vitest';
import { buildQuizDocument, type BuildQuizInput } from '@server/domain/quiz/postprocess';
import { validateSegment } from '@server/domain/quiz/validate';
import { exampleOutput, exampleTranscript } from './helpers';

const { lines, segments, flags } = exampleTranscript();

function input(output = exampleOutput(), patch: Partial<BuildQuizInput> = {}): BuildQuizInput {
  return {
    episodeKey: 'tmdb-1234-s01-e02',
    tmdbSeriesId: 1234,
    seasonNumber: 1,
    episodeNumber: 2,
    lines,
    flags,
    results: [
      { segment: segments[0], validation: { segmentId: 'S1', generated: 0, skipped: 0, valid: [], problems: [] }, technicalFailure: 'LLM_REFUSAL' },
      { segment: segments[1], validation: validateSegment(output, segments[1], lines), technicalFailure: null },
    ],
    source: { provider: 'opensubtitles', hearingImpaired: true, release: null },
    generation: { provider: 'fake', model: 'fake-claude', effort: 'medium', promptVersion: 'quiz-2026-10-v1', createdAt: new Date().toISOString() },
    includePtExplanation: true,
    ...patch,
  };
}

const byLine = new Map(lines.map((l) => [l.id, l]));

describe('Pós-processamento da Fase 1 (§8.8)', () => {
  it('P01: IDs de linha viram o intervalo de tempo da evidência', () => {
    const { document } = buildQuizDocument(input());
    const q = document.questions.find((x) => x.evidence.lineIds.join() === 'L043,L044')!;
    expect(q.evidence.startMs).toBe(byLine.get('L043')!.startMs);
    expect(q.evidence.endMs).toBe(byLine.get('L044')!.endMs);
  });

  it('P03: ordem cronológica, depois nível; IDs S2-Q01… e ordem global', () => {
    const { document } = buildQuizDocument(input());
    const qs = document.questions;
    expect(qs.map((q) => q.id)).toEqual(['S2-Q01', 'S2-Q02', 'S2-Q03', 'S2-Q04', 'S2-Q05', 'S2-Q06', 'S2-Q07', 'S2-Q08']);
    expect(qs.map((q) => q.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let i = 1; i < qs.length; i++) expect(qs[i].evidence.startMs).toBeGreaterThanOrEqual(qs[i - 1].evidence.startMs);
    // L046 é citada por uma B2 (com L047) e por uma C1: B2 vem antes
    expect(qs.filter((q) => q.evidence.lineIds[0] === 'L046').map((q) => q.level)).toEqual(['B2', 'C1']);
    expect(document.segments[1].questionIds).toEqual(qs.map((q) => q.id));
  });

  it('mapeia os campos: answer → answerId, focus "none" → null, explanation_en → explanationEn', () => {
    const { document } = buildQuizDocument(input());
    const comprehension = document.questions.find((q) => q.prompt === 'When is the rehearsal?')!;
    expect(comprehension).toMatchObject({ answerId: 'a', focus: null, flags: [] });
    expect(comprehension.explanationEn).toMatch(/^Maya tells Leo/);
    const idiom = document.questions.find((q) => q.focus?.kind === 'idiom')!;
    expect(idiom.focus).toEqual({ expression: 'pull an all-nighter', kind: 'idiom' });
  });

  it('P06: explicação em PT-BR vazia quando desativada', () => {
    const { document } = buildQuizDocument(input(exampleOutput(), { includePtExplanation: false }));
    expect(document.questions.every((q) => q.explanationPt === '')).toBe(true);
  });

  it('perguntas fora dos limites do §5.5 são descartadas e contadas', () => {
    const output = exampleOutput();
    output.questions[0] = { ...output.questions[0], prompt: 'Why?' }; // < 5 caracteres
    const { document, quality } = buildQuizDocument(input(output));
    expect(document.questions).toHaveLength(7);
    expect(quality.droppedByRule.DOCUMENT_SCHEMA_INVALID).toBe(1);
  });

  it('qualidade: bloco vazio, falha técnica, proporção citada e flags', () => {
    const { quality, document } = buildQuizDocument(input());
    expect(quality).toMatchObject({ generated: 8, kept: 8, emptySegments: ['S1'], flags: ['hi_subtitle'] });
    expect(quality.droppedByRule.LLM_REFUSAL).toBe(1);
    expect(quality.quoteWordRatio).toBeGreaterThan(0);
    expect(document).toMatchObject({ schemaVersion: '1.0', levels: ['A2', 'B1', 'B2', 'C1'] });
  });
});
