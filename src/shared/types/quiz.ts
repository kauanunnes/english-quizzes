import { z } from 'zod';

export const CefrLevelSchema = z.enum(['A2', 'B1', 'B2', 'C1']);
export type CefrLevel = z.infer<typeof CefrLevelSchema>;

export const QuestionTypeSchema = z.enum([
  'vocabulary',
  'true_false',
  'fill_blank',
  'comprehension',
  'inference',
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionEvidenceSchema = z.object({
  lineIds: z.array(z.string()),
  text: z.string(), // Citação curta (≤ 15 palavras)
  approxTimeSeconds: z.number(),
  formattedTime: z.string(), // ex: "≈03:12"
});
export type QuestionEvidence = z.infer<typeof QuestionEvidenceSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  level: CefrLevelSchema,
  type: QuestionTypeSchema,
  prompt: z.string(), // Enunciado em inglês
  options: z.array(z.string()),
  correctIndex: z.number(),
  evidence: QuestionEvidenceSchema,
  explanation: z.string(), // Explicação em inglês
  explanationPt: z.string().nullable().optional(), // Explicação em português
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuizSegmentSchema = z.object({
  id: z.string(), // ex: "S1"
  index: z.number(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  formattedStart: z.string(), // ex: "00:00"
  formattedEnd: z.string(), // ex: "05:12"
  label: z.string(), // ex: "Bloco 1 · 00:00–05:12"
  questions: z.array(QuestionSchema),
});
export type QuizSegment = z.infer<typeof QuizSegmentSchema>;

export const QuizDocumentSchema = z.object({
  episodeKey: z.string(), // ex: "tmdb-1234-s01-e04"
  seriesId: z.number(),
  seriesTitle: z.string(),
  seasonNumber: z.number(),
  episodeNumber: z.number(),
  episodeTitle: z.string(),
  runtimeMinutes: z.number(),
  segments: z.array(QuizSegmentSchema),
  totalQuestions: z.number(),
  createdAt: z.string(),
  source: z.enum(['opensubtitles', 'uploaded', 'mock']).default('opensubtitles'),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    costUsd: z.number(),
  }).optional(),
});
export type QuizDocument = z.infer<typeof QuizDocumentSchema>;
