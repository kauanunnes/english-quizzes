// server/integrations/llm/fake.ts — docs/04 §4.3.7: perguntas determinísticas a partir das linhas recebidas
import type { LlmQuestion, LlmSegmentOutput } from '@shared/types/llmSegmentOutput';
import type { CefrLevel, QuestionType } from '@shared/types/quiz';
import { LlmProvider, GenerateJsonRequest, GenerateJsonResult } from './provider';

type PromptLine = { id: string; text: string };

const SLOT_LINE = /^- (S\d+-(?:A2|B1|B2|C1)-[12]): level (A2|B1|B2|C1), type (\w+)$/gm;
const LINE = /^(L\d{3,4})(?: \[[^\]]+\])?: (.+)$/gm;

function parsePrompt(user: string) {
  const segmentId = /<segment id="(S\d+)">/.exec(user)?.[1] ?? 'S1';
  const slots = [...user.matchAll(SLOT_LINE)].map((m) => ({ id: m[1], level: m[2] as CefrLevel, type: m[3] as QuestionType }));
  // Só as linhas do bloco-alvo: as de <context> nunca são evidência válida
  const block = user.split('<lines>\n')[1]?.split('\n</lines>')[0] ?? '';
  const lines: PromptLine[] = [...block.matchAll(LINE)].map((m) => ({ id: m[1], text: m[2].trim() }));
  return { segmentId, slots, lines };
}

const firstWords = (text: string, n: number) => text.split(/\s+/).slice(0, n).join(' ');

function questionFor(slot: { id: string; level: CefrLevel; type: QuestionType }, line: PromptLine): LlmQuestion {
  const quote = firstWords(line.text, 12).slice(0, 110);
  const base = {
    slot: slot.id,
    level: slot.level,
    type: slot.type,
    evidence: { line_ids: [line.id], quote },
    focus: { expression: '', kind: 'none' as const },
    answer: 'a' as const,
    explanation_en: `The line says "${firstWords(quote, 6)}", which supports this answer.`,
    explanation_pt: `A fala diz "${firstWords(quote, 6)}", o que confirma a resposta.`,
  };

  const word = quote.split(/\s+/).find((w) => /^[A-Za-z]{4,}$/.test(w)) ?? 'line';
  switch (slot.type) {
    case 'true_false':
      return {
        ...base,
        prompt: `Someone says: "${firstWords(quote, 8)}".`,
        options: [
          { id: 'a', text: 'True' },
          { id: 'b', text: 'False' },
        ],
      };
    case 'fill_blank': {
      const distractors = ['never', 'always', 'maybe'].filter((d) => d !== word.toLowerCase());
      return {
        ...base,
        focus: { expression: word, kind: 'word' },
        prompt: `Complete the line: "${quote.replace(word, '_____')}"`,
        options: [word, ...distractors.slice(0, 3)].map((text, i) => ({ id: (['a', 'b', 'c', 'd'] as const)[i], text })),
      };
    }
    case 'vocabulary':
      return {
        ...base,
        focus: { expression: word, kind: 'word' },
        prompt: `In this scene, what does "${word}" mean?`,
        options: [
          { id: 'a', text: `The meaning of "${word}" in this line` },
          { id: 'b', text: 'An unrelated action' },
          { id: 'c', text: 'The opposite idea' },
          { id: 'd', text: 'A physical object' },
        ],
      };
    default:
      return {
        ...base,
        prompt: 'What is this part of the conversation about?',
        options: [
          { id: 'a', text: 'What the speaker just said' },
          { id: 'b', text: 'A change of subject' },
          { id: 'c', text: 'Someone leaving the scene' },
          { id: 'd', text: 'Nothing important' },
        ],
      };
  }
}

export const fakeLlmProvider: LlmProvider = {
  name: 'fake',
  async generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResult> {
    const started = Date.now();
    const { segmentId, slots, lines } = parsePrompt(req.user);

    const output: LlmSegmentOutput = {
      segment_id: segmentId,
      questions: lines.length ? slots.map((slot, i) => questionFor(slot, lines[Math.floor((i * lines.length) / slots.length)])) : [],
      skipped: lines.length ? [] : slots.map((slot) => ({ slot: slot.id, reason: 'no lines' })),
    };

    return {
      json: output,
      stopReason: 'end_turn',
      usage: { inputTokens: 1200, outputTokens: 800, cacheReadTokens: 0, cacheWriteTokens: 0 },
      model: 'fake-claude',
      servedByFallback: false,
      latencyMs: Date.now() - started,
    };
  },
};
