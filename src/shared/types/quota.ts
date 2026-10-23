import { z } from 'zod';

export const QuotaStatusSchema = z.object({
  subtitlesRemaining: z.number(),
  subtitlesRequestsToday: z.number(),
  resetTimeUtc: z.string().nullable(),
  resetTimeFormatted: z.string().nullable(),
  isSubtitlesExhausted: z.boolean(),
  llmSpentTodayUsd: z.number(),
  llmBudgetDailyUsd: z.number(),
  isLlmBudgetExceeded: z.boolean(),
});
export type QuotaStatus = z.infer<typeof QuotaStatusSchema>;
