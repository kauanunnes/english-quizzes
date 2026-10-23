import { z } from 'zod';
import { CefrLevelSchema, OptionIdSchema, QuestionTypeSchema } from './quiz';

// docs/08 §8.6 — saída da LLM por bloco. Sem limites de tamanho aqui (a saída estruturada não os aceita);
// eles ficam na validação semântica. A ordem dos campos é proposital: evidência primeiro.
// O JSON Schema enviado à API é gerado deste arquivo: src/shared/schemas/llm-segment-output.schema.json
// (pnpm gen:schema; um teste falha se o arquivo commitado divergir).

export const LlmQuestionSchema = z.strictObject({
  slot: z.string(),
  level: CefrLevelSchema,
  type: QuestionTypeSchema,
  evidence: z.strictObject({ line_ids: z.array(z.string().regex(/^L\d{3,4}$/)), quote: z.string() }),
  focus: z.strictObject({
    expression: z.string(),
    kind: z.enum(['none', 'word', 'phrasal_verb', 'idiom', 'slang', 'collocation', 'grammar']),
  }),
  prompt: z.string(),
  options: z.array(z.strictObject({ id: OptionIdSchema, text: z.string() })),
  answer: OptionIdSchema,
  explanation_en: z.string(),
  explanation_pt: z.string(),
});
export type LlmQuestion = z.infer<typeof LlmQuestionSchema>;

export const LlmSegmentOutputSchema = z.strictObject({
  segment_id: z.string(),
  questions: z.array(LlmQuestionSchema),
  skipped: z.array(z.strictObject({ slot: z.string(), reason: z.string() })),
});
export type LlmSegmentOutput = z.infer<typeof LlmSegmentOutputSchema>;

export function llmSegmentOutputJsonSchema(): Record<string, unknown> {
  const schema = { ...(z.toJSONSchema(LlmSegmentOutputSchema) as Record<string, unknown>) };
  delete schema.$schema;
  return schema;
}
