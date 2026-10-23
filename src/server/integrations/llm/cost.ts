// server/integrations/llm/cost.ts
import { GenerateJsonResult } from './provider';

export function costUsd(
  u: GenerateJsonResult['usage'],
  p: { inPerMTok: number; outPerMTok: number; cacheReadPerMTok: number }
): number {
  return (
    u.inputTokens * p.inPerMTok +
    u.outputTokens * p.outPerMTok +
    u.cacheWriteTokens * p.inPerMTok * 1.25 +
    u.cacheReadTokens * p.cacheReadPerMTok
  ) / 1_000_000;
}
