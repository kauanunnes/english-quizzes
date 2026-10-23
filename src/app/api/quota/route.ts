import { NextResponse } from 'next/server';
import { env } from '@server/env';

export async function GET() {
  const resetDate = new Date();
  resetDate.setUTCHours(23, 59, 59, 999);

  return NextResponse.json({
    subtitlesRemaining: 20,
    subtitlesRequestsToday: 0,
    resetTimeUtc: resetDate.toISOString(),
    resetTimeFormatted: resetDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    isSubtitlesExhausted: false,
    llmSpentTodayUsd: 0.05,
    llmBudgetDailyUsd: env.LLM_DAILY_BUDGET_USD,
    isLlmBudgetExceeded: false,
  });
}
