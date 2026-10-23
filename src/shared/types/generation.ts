import { z } from 'zod';
import { QuizDocumentSchema } from './quiz';
import { ErrorCodeSchema } from './errors';

// docs/06 §6.3 (DTOs de geração) e §6.6 (estágios do job)

export const QuizResponseSchema = z.object({
  quizId: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  episode: z.object({
    // de `episodes` (pode ser null após 170 dias)
    seriesName: z.string().nullable(),
    episodeName: z.string().nullable(),
    runtimeMin: z.number().int().nullable(),
  }),
  quiz: QuizDocumentSchema,
});
export type QuizResponse = z.infer<typeof QuizResponseSchema>;

export const GenerateQuizBodySchema = z.object({ force: z.boolean().default(false) }).strict();
export type GenerateQuizBody = z.infer<typeof GenerateQuizBodySchema>;

export const GenerateQuizReadySchema = z.object({
  status: z.literal('ready'),
  quizId: z.string().uuid(),
  version: z.number().int(),
});
export type GenerateQuizReady = z.infer<typeof GenerateQuizReadySchema>;

export const GenerateQuizAcceptedSchema = z.object({
  status: z.enum(['queued', 'running']),
  jobId: z.string().uuid(),
  pollAfterMs: z.number().int(),
});
export type GenerateQuizAccepted = z.infer<typeof GenerateQuizAcceptedSchema>;

export const JOB_STAGES = ['queued', 'resolving', 'searching', 'downloading', 'parsing', 'generating', 'validating', 'ready', 'failed'] as const;
export const JobStageSchema = z.enum(JOB_STAGES);
export type JobStage = z.infer<typeof JobStageSchema>;

export const JobStatusSchema = z.object({
  jobId: z.string().uuid(),
  episodeKey: z.string(),
  status: z.enum(['queued', 'running', 'ready', 'failed']),
  stage: JobStageSchema,
  progress: z.number().int().min(0).max(100),
  segments: z.object({ done: z.number().int(), total: z.number().int() }).nullable(),
  quizId: z.string().uuid().nullable(),
  error: z
    .object({
      code: ErrorCodeSchema,
      message: z.string(), // PT-BR, pronto para a UI
      retryAfterSec: z.number().int().optional(),
      resetAt: z.string().datetime().optional(),
    })
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pollAfterMs: z.number().int().nullable(), // null em estado terminal
});
export type JobStatus = z.infer<typeof JobStatusSchema>;

// §6.6: progresso de cada estágio; `generating` vai de 40 a 90 conforme os blocos ficam prontos
export const STAGE_PROGRESS: Record<Exclude<JobStage, 'generating' | 'failed'>, number> = {
  queued: 0,
  resolving: 5,
  searching: 15,
  downloading: 25,
  parsing: 35,
  validating: 95,
  ready: 100,
};

export function generatingProgress(done: number, total: number): number {
  return total > 0 ? Math.round(40 + (50 * done) / total) : 40;
}

// Mensagens da UI por estágio (§6.6)
export function stageMessage(stage: JobStage, segments: { done: number; total: number } | null): string {
  switch (stage) {
    case 'queued':
      return 'Na fila…';
    case 'resolving':
      return 'Identificando o episódio…';
    case 'searching':
      return 'Procurando legenda em inglês…';
    case 'downloading':
      return 'Baixando a legenda…';
    case 'parsing':
      return 'Limpando o texto…';
    case 'generating':
      return segments ? `Criando perguntas (${segments.done}/${segments.total} blocos)…` : 'Criando perguntas…';
    case 'validating':
      return 'Conferindo as perguntas…';
    case 'ready':
      return 'Pronto!';
    case 'failed':
      return 'Não foi possível gerar.';
  }
}

// §6.6: 2 s nos primeiros 20 s do job, depois 4 s; null em estado terminal
export function pollAfterMs(status: JobStatus['status'], createdAt: Date, now = Date.now()): number | null {
  if (status === 'ready' || status === 'failed') return null;
  return now - createdAt.getTime() < 20_000 ? 2000 : 4000;
}
