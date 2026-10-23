// server/integrations/llm/provider.ts
export type Effort = 'low' | 'medium' | 'high';

export interface GenerateJsonRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  effort: Effort;
  thinking: 'adaptive' | 'off';
  timeoutMs: number;
  signal?: AbortSignal;
  meta: { jobId: string; segmentId: string; attempt: number };
}

export interface GenerateJsonResult {
  json: unknown | null;
  stopReason: 'end_turn' | 'max_tokens' | 'refusal' | 'other';
  refusalCategory?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  model: string;
  latencyMs: number;
}

export interface LlmProvider {
  readonly name: 'anthropic' | 'fake';
  generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResult>;
}
