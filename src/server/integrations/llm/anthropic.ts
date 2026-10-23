// server/integrations/llm/anthropic.ts — docs/04 §4.3.2
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@server/env';
import { LlmProvider, GenerateJsonRequest, GenerateJsonResult } from './provider';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

// Sonnet 5.5 rejeita {type: 'disabled'} e usa 'between_tools' para não pensar (até esforço high);
// Haiku 5.5 aceita 'disabled' com esforço até high (§4.3.3)
function thinkingOff(model: string) {
  return model.startsWith('claude-sonnet-5-5') ? ({ type: 'between_tools' as const }) : ({ type: 'disabled' as const });
}

// Em recusa, o servidor reexecuta a mesma requisição num modelo escolhido pela categoria ("default").
// Só com pensamento ligado ('between_tools' não vale no modelo de fallback); o Haiku 5.5 não tem fallback.
const SERVER_FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

function serverFallbackEnabled(model: string, thinking: GenerateJsonRequest['thinking']): boolean {
  return thinking !== 'off' && SERVER_FALLBACK_MODELS.has(model);
}

function normalizeStop(reason: string | null): GenerateJsonResult['stopReason'] {
  return reason === 'end_turn' || reason === 'max_tokens' || reason === 'refusal' ? reason : 'other';
}

export const anthropicProvider: LlmProvider = {
  name: 'anthropic',
  async generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResult> {
    const started = Date.now();
    const fallback = serverFallbackEnabled(env.LLM_MODEL, req.thinking);

    const response = await getClient().beta.messages.create(
      {
        model: env.LLM_MODEL,
        max_tokens: req.maxTokens,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.user }],
        output_config: {
          effort: req.effort,
          format: { type: 'json_schema', schema: req.schema },
        },
        ...(req.thinking === 'off' ? { thinking: thinkingOff(env.LLM_MODEL) } : {}),
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        // NÃO enviar: temperature, top_p, top_k, prefill de assistente, tool_choice forçado
      },
      { signal: req.signal, timeout: req.timeoutMs }
    );

    // Blocos de pensamento (e de fallback) podem vir antes do texto: ler por tipo, nunca content[0]
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');

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
      stopReason: normalizeStop(response.stop_reason),
      refusalCategory: response.stop_details?.category ?? undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      model: response.model,
      servedByFallback: response.content.some((b) => b.type === 'fallback'),
      latencyMs: Date.now() - started,
    };
  },
};
