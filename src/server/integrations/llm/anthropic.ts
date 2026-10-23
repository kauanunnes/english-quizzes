// server/integrations/llm/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@server/env';
import { LlmProvider, GenerateJsonRequest, GenerateJsonResult } from './provider';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY || '',
      maxRetries: 2,
    });
  }
  return client;
}

function thinkingOff(model: string) {
  return model.startsWith('claude-sonnet-5-5')
    ? ({ type: 'between_tools' as const })
    : ({ type: 'disabled' as const });
}

export const anthropicProvider: LlmProvider = {
  name: 'anthropic',
  async generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResult> {
    const started = Date.now();
    const anthropic = getClient();

    const response = await anthropic.messages.create(
      {
        model: env.LLM_MODEL,
        max_tokens: req.maxTokens,
        system: [
          {
            type: 'text',
            text: req.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: req.user }],
        output_config: {
          effort: req.effort,
          format: { type: 'json_schema', schema: req.schema },
        },
        ...(req.thinking === 'off' ? { thinking: thinkingOff(env.LLM_MODEL) } : {}),
      },
      { signal: req.signal, timeout: req.timeoutMs }
    );

    // Read content by type (thinking blocks may come before text)
    const text = response.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('');

    let json: unknown | null = null;
    if (response.stop_reason === 'end_turn') {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      json,
      stopReason: response.stop_reason === 'end_turn'
        ? 'end_turn'
        : response.stop_reason === 'max_tokens'
        ? 'max_tokens'
        : response.stop_reason === 'refusal'
        ? 'refusal'
        : 'other',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      model: response.model,
      latencyMs: Date.now() - started,
    };
  },
};
