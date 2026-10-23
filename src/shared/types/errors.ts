import { z } from 'zod';

// docs/06 §6.3 e §6.5
export const ErrorCodeSchema = z.enum([
  'INVALID_INPUT', 'FORBIDDEN_ORIGIN',
  'ACCESS_CODE_REQUIRED', 'ACCESS_CODE_INVALID', 'ADMIN_UNAUTHORIZED',
  'SERIES_NOT_FOUND', 'SEASON_NOT_FOUND', 'EPISODE_NOT_FOUND', 'QUIZ_NOT_FOUND', 'JOB_NOT_FOUND',
  'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_SUBTITLE_FORMAT',
  'SUBTITLE_NOT_FOUND', 'SUBTITLE_UNUSABLE',
  'RATE_LIMITED', 'EPISODE_RETRY_LIMIT',
  'SUBTITLE_QUOTA_EXCEEDED', 'GENERATION_LIMIT_REACHED', 'BUDGET_EXCEEDED',
  'UPSTREAM_AUTH_FAILED', 'UPSTREAM_RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT',
  'LLM_FAILED', 'QUALITY_CHECK_FAILED', 'JOB_STALLED', 'JOB_DEADLINE_EXCEEDED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ProblemSchema = z.object({
  type: z.string(), // https://segunda-tela.app/errors/<code-em-kebab>
  title: z.string(),
  status: z.number().int(),
  code: ErrorCodeSchema,
  detail: z.string().optional(),
  requestId: z.string(),
  retryAfterSec: z.number().int().optional(),
  resetAt: z.string().datetime().optional(),
  fields: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

// Mensagens da UI (PT-BR), §6.5. QUIZ_NOT_FOUND é estado normal ("Gerar quiz").
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Algo saiu errado com o pedido. Atualize a página.',
  FORBIDDEN_ORIGIN: 'Pedido bloqueado por segurança.',
  ACCESS_CODE_REQUIRED: 'Digite o código de acesso para gerar quizzes.',
  ACCESS_CODE_INVALID: 'Código inválido.',
  ADMIN_UNAUTHORIZED: 'Acesso negado.',
  SERIES_NOT_FOUND: 'Não encontramos essa série.',
  SEASON_NOT_FOUND: 'Não encontramos essa temporada.',
  EPISODE_NOT_FOUND: 'Não encontramos esse episódio.',
  QUIZ_NOT_FOUND: 'Este episódio ainda não tem quiz.',
  JOB_NOT_FOUND: 'Esse processamento não existe mais. Tente gerar de novo.',
  PAYLOAD_TOO_LARGE: 'O arquivo passa de 1 MB.',
  UNSUPPORTED_SUBTITLE_FORMAT: 'Envie um arquivo .srt ou .vtt.',
  SUBTITLE_NOT_FOUND: 'Não achamos legenda em inglês para este episódio.',
  SUBTITLE_UNUSABLE: 'A legenda encontrada parece incompleta ou de outro episódio.',
  RATE_LIMITED: 'Muitos pedidos em pouco tempo. Tente em alguns minutos.',
  EPISODE_RETRY_LIMIT: 'Este episódio já foi tentado duas vezes hoje.',
  SUBTITLE_QUOTA_EXCEEDED: 'A cota diária de legendas acabou. Os quizzes já gerados continuam disponíveis.',
  GENERATION_LIMIT_REACHED: 'O limite de gerações de hoje foi atingido.',
  BUDGET_EXCEEDED: 'O limite de uso da IA de hoje foi atingido.',
  UPSTREAM_AUTH_FAILED: 'Problema de configuração no servidor. Já fomos avisados.',
  UPSTREAM_RATE_LIMITED: 'O serviço externo pediu uma pausa. Tente em instantes.',
  UPSTREAM_UNAVAILABLE: 'Um serviço externo está fora do ar. Tente de novo.',
  UPSTREAM_TIMEOUT: 'O serviço externo demorou demais. Tente de novo.',
  LLM_FAILED: 'Não conseguimos criar as perguntas agora. Tente de novo.',
  QUALITY_CHECK_FAILED: 'As perguntas não passaram na conferência de qualidade. Tente de novo.',
  JOB_STALLED: 'O processamento foi interrompido. Tente de novo.',
  JOB_DEADLINE_EXCEEDED: 'O processamento foi interrompido. Tente de novo.',
  INTERNAL: 'Erro inesperado. Tente de novo.',
};
