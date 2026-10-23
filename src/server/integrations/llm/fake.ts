// server/integrations/llm/fake.ts
import { LlmProvider, GenerateJsonRequest, GenerateJsonResult } from './provider';

export const fakeLlmProvider: LlmProvider = {
  name: 'fake',
  async generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResult> {
    const started = Date.now();

    // Parse lines from user prompt: L001 [SPEAKER]: Text...
    // Only the target block counts: context lines from the previous block are never valid evidence
    const targetStart = req.user.indexOf('--- TARGET SEGMENT');
    const targetText = targetStart >= 0 ? req.user.slice(targetStart) : req.user;
    const lineMatches = Array.from(targetText.matchAll(/(L\d{3})(?: \[([^\]]+)\])?: (.*)/g));
    const lines = lineMatches.map((m) => ({
      id: m[1],
      speaker: m[2],
      text: m[3].trim(),
    }));

    const questions: Record<string, unknown>[] = [];
    const levels = ['A2', 'A2', 'B1', 'B1', 'B2', 'B2', 'C1', 'C1'];
    const types = [
      'vocabulary',
      'comprehension',
      'true_false',
      'fill_blank',
      'inference',
      'vocabulary',
      'comprehension',
      'inference',
    ];

    if (lines.length > 0) {
      for (let i = 0; i < levels.length; i++) {
        const lineIdx = Math.min(i * Math.floor(lines.length / levels.length), lines.length - 1);
        const targetLine = lines[lineIdx];
        const words = targetLine.text.split(' ');
        const snippet = words.slice(0, Math.min(10, words.length)).join(' ');

        const level = levels[i];
        const qType = types[i];

        if (qType === 'true_false') {
          questions.push({
            id: `q_${req.meta.segmentId}_${i + 1}`,
            level,
            type: 'true_false',
            prompt: `Based on the dialogue, is it true that: "${snippet}"?`,
            options: ['True', 'False'],
            correctIndex: 0,
            evidence: {
              lineIds: [targetLine.id],
              text: snippet,
            },
            explanation: `As stated in line ${targetLine.id}: "${snippet}".`,
            explanationPt: `Como afirmado na linha ${targetLine.id}: "${snippet}".`,
          });
        } else if (qType === 'fill_blank') {
          const blankWord = words[0] || 'word';
          const blankSentence = targetLine.text.replace(blankWord, '_____');
          questions.push({
            id: `q_${req.meta.segmentId}_${i + 1}`,
            level,
            type: 'fill_blank',
            prompt: `Complete the sentence: "${blankSentence}"`,
            options: [blankWord, 'never', 'always', 'sometimes'],
            correctIndex: 0,
            evidence: {
              lineIds: [targetLine.id],
              text: snippet,
            },
            explanation: `The character actually says "${targetLine.text}".`,
            explanationPt: `O personagem diz exatamente "${targetLine.text}".`,
          });
        } else if (qType === 'vocabulary') {
          const targetWord = words.find((w) => w.length > 4) || words[0] || 'expression';
          questions.push({
            id: `q_${req.meta.segmentId}_${i + 1}`,
            level,
            type: 'vocabulary',
            prompt: `In this scene, what does the word/phrase "${targetWord}" mean?`,
            options: [
              `The context-appropriate meaning of ${targetWord}`,
              'A completely unrelated action',
              'An opposite reaction',
              'A physical object',
            ],
            correctIndex: 0,
            evidence: {
              lineIds: [targetLine.id],
              text: snippet,
            },
            explanation: `In this context, "${targetWord}" refers to ${snippet}.`,
            explanationPt: `Neste contexto, "${targetWord}" refere-se a ${snippet}.`,
          });
        } else {
          questions.push({
            id: `q_${req.meta.segmentId}_${i + 1}`,
            level,
            type: qType,
            prompt: `What can be inferred when the dialogue says: "${snippet}"?`,
            options: [
              'The speaker is expressing their immediate situation',
              'The speaker is changing the subject',
              'The characters are leaving the scene',
              'Nothing of importance happened',
            ],
            correctIndex: 0,
            evidence: {
              lineIds: [targetLine.id],
              text: snippet,
            },
            explanation: `The dialogue in ${targetLine.id} directly demonstrates this.`,
            explanationPt: `O diálogo em ${targetLine.id} demonstra isso diretamente.`,
          });
        }
      }
    }

    return {
      json: { questions },
      stopReason: 'end_turn',
      usage: {
        inputTokens: 1200,
        outputTokens: 800,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      model: 'fake-claude',
      latencyMs: Date.now() - started,
    };
  },
};
