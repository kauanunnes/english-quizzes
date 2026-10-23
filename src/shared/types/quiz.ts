import { z } from 'zod';

// docs/05 §5.5 — documento do quiz (quizzes.payload), contrato entre back e front.
// O schema de saída da LLM (por bloco) é outro: llmSegmentOutput.ts.

export const CefrLevelSchema = z.enum(['A2', 'B1', 'B2', 'C1']);
export type CefrLevel = z.infer<typeof CefrLevelSchema>;
export const LEVEL_ORDER: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];

export const QuestionTypeSchema = z.enum(['comprehension', 'inference', 'vocabulary', 'true_false', 'fill_blank']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const OptionIdSchema = z.enum(['a', 'b', 'c', 'd']);
export type OptionId = z.infer<typeof OptionIdSchema>;

export const FocusKindSchema = z.enum(['word', 'phrasal_verb', 'idiom', 'slang', 'collocation', 'grammar']);
export type FocusKind = z.infer<typeof FocusKindSchema>;

export const EvidenceSchema = z.object({
  lineIds: z.array(z.string().regex(/^L\d{3,4}$/)).min(1).max(4),
  quote: z.string().min(1).max(120), // ≤ 15 palavras (checagem à parte)
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const QuestionSchema = z.object({
  id: z.string().regex(/^S\d+-Q\d{2}$/), // 'S2-Q05', estável dentro da versão
  segmentId: z.string().regex(/^S\d+$/),
  order: z.number().int().nonnegative(), // ordem global, cronológica
  level: CefrLevelSchema,
  type: QuestionTypeSchema,
  prompt: z.string().min(5).max(300), // inglês
  options: z.array(z.object({ id: OptionIdSchema, text: z.string().min(1).max(160) })).min(2).max(4),
  answerId: OptionIdSchema,
  explanationEn: z.string().min(5).max(400),
  explanationPt: z.string().max(400), // '' se desativado
  evidence: EvidenceSchema,
  focus: z.object({ expression: z.string().min(1).max(60), kind: FocusKindSchema }).nullable(),
  flags: z.array(z.string()), // ex.: 'quote_trimmed'
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuizSegmentSchema = z.object({
  id: z.string().regex(/^S\d+$/),
  index: z.number().int().positive(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  label: z.string(), // '00:00–05:12'
  questionIds: z.array(z.string()),
});
export type QuizSegment = z.infer<typeof QuizSegmentSchema>;

export const QuizDocumentSchema = z.object({
  schemaVersion: z.literal('1.0'),
  episodeKey: z.string(),
  tmdbSeriesId: z.number().int(),
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  levels: z.array(CefrLevelSchema),
  segments: z.array(QuizSegmentSchema),
  questions: z.array(QuestionSchema),
  source: z.object({
    provider: z.enum(['opensubtitles', 'upload', 'subdl']),
    hearingImpaired: z.boolean().nullable(),
    release: z.string().nullable(),
  }),
  generation: z.object({
    provider: z.string(),
    model: z.string(),
    effort: z.string().nullable(),
    promptVersion: z.string(),
    createdAt: z.string().datetime(),
  }),
});
export type QuizDocument = z.infer<typeof QuizDocumentSchema>;

export type QuizUsage = {
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs: number;
  subtitleDownloads: number;
};

export type QuizQuality = {
  generated: number;
  kept: number;
  droppedByRule: Record<string, number>; // ex.: { EVIDENCE_LINES_INVALID: 2 }
  retriedSegments: string[];
  emptySegments: string[];
  quoteWordRatio: number; // palavras citadas ÷ palavras do diálogo (≤ 0,15)
  flags: string[]; // ex.: 'hi_subtitle', 'musical_heavy', 'all_caps'
};
