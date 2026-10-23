import {
  LEVEL_ORDER,
  QuestionSchema,
  QuizDocumentSchema,
  type FocusKind,
  type Question,
  type QuizDocument,
  type QuizQuality,
  type QuizSegment,
} from '@shared/types/quiz';
import type { LlmQuestion } from '@shared/types/llmSegmentOutput';
import type { Line, Segment, Transcript } from '../subtitles/types';
import type { SegmentValidation } from './validate';

// docs/08 §8.8 — Fase 1: P01 (IDs de linha → tempos), P03 (ordem e IDs), P06 (aparar) e P07 (montar e validar).
// Embaralhamento (P02), orçamento de citação (P04) e deduplicação (P05) entram na Fase 4.

export type SegmentResult = { segment: Segment; validation: SegmentValidation; technicalFailure: string | null };

export type BuildQuizInput = {
  episodeKey: string;
  tmdbSeriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  lines: Line[];
  flags: Transcript['flags'];
  results: SegmentResult[];
  source: QuizDocument['source'];
  generation: QuizDocument['generation'];
  includePtExplanation: boolean;
};

type Draft = Omit<Question, 'id' | 'order'>;

const DraftSchema = QuestionSchema.omit({ id: true, order: true });
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

function toDraft(q: LlmQuestion, segmentId: string, lineById: Map<string, Line>, includePt: boolean): Draft {
  const cited = q.evidence.line_ids.map((id) => lineById.get(id)).filter((l): l is Line => l !== undefined);
  const expression = q.focus.expression.trim();
  return {
    segmentId,
    level: q.level,
    type: q.type,
    prompt: q.prompt.trim(),
    options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
    answerId: q.answer,
    explanationEn: q.explanation_en.trim(),
    explanationPt: includePt ? q.explanation_pt.trim() : '',
    evidence: {
      lineIds: q.evidence.line_ids,
      quote: q.evidence.quote.trim(),
      startMs: Math.min(...cited.map((l) => l.startMs)), // P01
      endMs: Math.max(...cited.map((l) => l.endMs)),
    },
    focus: q.focus.kind === 'none' || !expression ? null : { expression, kind: q.focus.kind as FocusKind },
    flags: [],
  };
}

export function buildQuizDocument(input: BuildQuizInput): { document: QuizDocument; quality: QuizQuality } {
  const lineById = new Map(input.lines.map((l) => [l.id, l]));
  const droppedByRule: Record<string, number> = {};
  const drop = (code: string) => {
    droppedByRule[code] = (droppedByRule[code] ?? 0) + 1;
  };

  const questions: Question[] = [];
  const segments: QuizSegment[] = [];
  let order = 0;

  for (const { segment, validation, technicalFailure } of input.results) {
    // Falha técnica conta o bloco perdido (recusa, truncamento, JSON inválido)
    if (technicalFailure) drop(technicalFailure);
    for (const problem of validation.problems) drop(problem.code);

    const drafts: Draft[] = [];
    for (const q of validation.valid) {
      const parsed = DraftSchema.safeParse(toDraft(q, segment.id, lineById, input.includePtExplanation));
      if (parsed.success) drafts.push(parsed.data);
      else drop('DOCUMENT_SCHEMA_INVALID'); // limites de tamanho do §5.5
    }

    // P03: por início da evidência e depois por nível; IDs S{n}-Q01… e ordem global
    drafts.sort(
      (a, b) => a.evidence.startMs - b.evidence.startMs || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    );
    const ids = drafts.map((draft, i) => {
      const id = `${segment.id}-Q${String(i + 1).padStart(2, '0')}`;
      questions.push({ id, order: order++, ...draft });
      return id;
    });

    segments.push({
      id: segment.id,
      index: segment.index,
      startMs: segment.startMs,
      endMs: segment.endMs,
      label: segment.label,
      questionIds: ids,
    });
  }

  const dialogueWords = input.lines.reduce((sum, l) => sum + countWords(l.text), 0);
  const quotedWords = questions.reduce(
    (sum, q) => sum + countWords(q.evidence.quote) + (q.type === 'fill_blank' ? countWords(q.prompt) : 0),
    0
  );

  const quality: QuizQuality = {
    generated: input.results.reduce((sum, r) => sum + r.validation.generated, 0),
    kept: questions.length,
    droppedByRule,
    retriedSegments: [],
    emptySegments: segments.filter((s) => s.questionIds.length === 0).map((s) => s.id),
    quoteWordRatio: dialogueWords ? Math.round((quotedWords / dialogueWords) * 1000) / 1000 : 0,
    flags: [
      ...(input.flags.hiStyle ? ['hi_subtitle'] : []),
      ...(input.flags.musicalHeavy ? ['musical_heavy'] : []),
      ...(input.flags.allCaps ? ['all_caps'] : []),
    ],
  };

  // P07
  const document = QuizDocumentSchema.parse({
    schemaVersion: '1.0',
    episodeKey: input.episodeKey,
    tmdbSeriesId: input.tmdbSeriesId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    levels: LEVEL_ORDER,
    segments,
    questions,
    source: input.source,
    generation: input.generation,
  });

  return { document, quality };
}
