import { SubtitleSegment } from '../subtitles/types';

export const QUIZ_SEGMENT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['questions'],
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'level',
          'type',
          'prompt',
          'options',
          'correctIndex',
          'evidence',
          'explanation',
          'explanationPt',
        ],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          level: { type: 'string', enum: ['A2', 'B1', 'B2', 'C1'] },
          type: {
            type: 'string',
            enum: ['vocabulary', 'true_false', 'fill_blank', 'comprehension', 'inference'],
          },
          prompt: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
          correctIndex: { type: 'integer' },
          evidence: {
            type: 'object',
            required: ['lineIds', 'text'],
            additionalProperties: false,
            properties: {
              lineIds: {
                type: 'array',
                items: { type: 'string' },
              },
              text: { type: 'string' },
            },
          },
          explanation: { type: 'string' },
          explanationPt: { type: 'string' },
        },
      },
    },
  },
};

export function buildSystemPrompt(seriesTitle?: string, episodeTitle?: string): string {
  return `You are an expert English language tutor creating a "second screen" interactive quiz for students learning English through TV series dialogues.
${seriesTitle ? `Series: ${seriesTitle}` : ''}
${episodeTitle ? `Episode: ${episodeTitle}` : ''}

CRITICAL RULES:
1. ANCHORED IN DIALOGUE: Questions must test understanding of what characters ACTUALLY SAID in the TARGET block. Never ask about visual elements (actions without speech, clothes, backgrounds).
2. EVIDENCE: Every question MUST have an "evidence" field with the exact line IDs (e.g. ["L042"]) and an exact short verbatim quotation (<= 15 words) found in those lines.
3. NO SPOILERS: Questions and evidence MUST ONLY reference the lines in the TARGET block. Do NOT use lines from the background context lines for evidence.
4. CEFR LEVELS: Generate exactly 8 questions: 2 for A2, 2 for B1, 2 for B2, and 2 for C1.
   - A2: Basic comprehension, simple vocabulary, straightforward facts.
   - B1: Everyday idioms, main points of clear speech, connecting ideas.
   - B2: Nuances, phrasal verbs, humor, conversational subtleties.
   - C1: Complex inference, sarcasm, cultural subtext, advanced idiomatic usage.
5. QUESTION TYPES: Rotate among:
   - "vocabulary": Meaning of colloquial expressions/words in this context.
   - "true_false": Statement about the dialogue; options MUST be ["True", "False"].
   - "fill_blank": Complete a sentence with a missing key word/phrase from the dialogue.
   - "comprehension": What does a character mean or want in this conversation?
   - "inference": What can be deduced about attitudes, intentions, or emotions?
6. OPTIONS & EXPLANATIONS:
   - Provide 4 plausible options for multiple choice (or 2 for true_false).
   - "correctIndex" is the 0-based index of the correct option.
   - "explanation": 1 concise sentence in English explaining why the answer is correct based on the evidence.
   - "explanationPt": 1 concise sentence in Brazilian Portuguese explaining the answer clearly for a Brazilian student.`;
}

export function buildUserPrompt(segment: SubtitleSegment): string {
  let prompt = '';

  if (segment.contextLines && segment.contextLines.length > 0) {
    prompt += '--- PREVIOUS CONTEXT (FOR BACKGROUND ONLY - DO NOT ASK QUESTIONS ABOUT THESE LINES) ---\n';
    for (const line of segment.contextLines) {
      prompt += `${line.id}${line.speaker ? ` [${line.speaker}]` : ''}: ${line.text}\n`;
    }
    prompt += '\n';
  }

  prompt += `--- TARGET SEGMENT ${segment.id} (${segment.formattedStart} - ${segment.formattedEnd}) ---\n`;
  prompt += 'Generate the 8 quiz questions strictly based on the following dialogue lines:\n';
  for (const line of segment.lines) {
    prompt += `${line.id}${line.speaker ? ` [${line.speaker}]` : ''}: ${line.text}\n`;
  }

  return prompt;
}
