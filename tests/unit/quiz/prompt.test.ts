import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SYSTEM_PROMPT, buildUserMessage } from '@server/domain/quiz/prompt';
import { slotPlanFor } from '@server/domain/quiz/slotPlan';
import { renderSegment } from '@server/domain/subtitles/render';
import { exampleTranscript } from './helpers';

describe('Plano de slots (§8.2)', () => {
  it('bloco ímpar: 8 slots, 2 por nível, com os tipos da tabela', () => {
    expect(slotPlanFor('S1', 1).map((s) => `${s.id}:${s.type}`)).toEqual([
      'S1-A2-1:true_false', 'S1-A2-2:comprehension',
      'S1-B1-1:comprehension', 'S1-B1-2:vocabulary',
      'S1-B2-1:inference', 'S1-B2-2:vocabulary',
      'S1-C1-1:inference', 'S1-C1-2:vocabulary',
    ]);
  });

  it('bloco par usa a outra coluna', () => {
    expect(slotPlanFor('S2', 2).map((s) => s.type)).toEqual([
      'comprehension', 'fill_blank', 'true_false', 'vocabulary', 'comprehension', 'inference', 'vocabulary', 'inference',
    ]);
  });
});

describe('Prompt (§8.3 e §8.4)', () => {
  it('o prompt de sistema é exatamente o do documento', () => {
    const doc = readFileSync('docs/08-geracao-quiz.md', 'utf8');
    const block = doc.split('## 8.3')[1].split('```text\n')[1].split('\n```')[0];
    expect(SYSTEM_PROMPT).toBe(block);
  });

  it('a mensagem do bloco S2 do exemplo (§8.12) sai idêntica à do documento', () => {
    const { lines, segments, flags } = exampleTranscript();
    const message = buildUserMessage({
      seriesTitle: 'Example Show',
      episodeTitle: 'The Missing Crown',
      seasonNumber: 1,
      episodeNumber: 2,
      segmentId: 'S2',
      segmentIndex: 2,
      segmentTotal: 4,
      slots: slotPlanFor('S2', 2),
      renderedSegment: renderSegment(lines, segments, 'S2'),
      flags,
      includePtExplanation: true,
    });
    expect(message).toBe(readFileSync('tests/fixtures/llm/example-S2.input.txt', 'utf8').trimEnd());
  });

  it('sem títulos da OpenSubtitles, a série vira "unknown" e o episódio fica sem título', () => {
    const message = buildUserMessage({
      seriesTitle: null,
      episodeTitle: null,
      seasonNumber: 3,
      episodeNumber: 12,
      segmentId: 'S1',
      segmentIndex: 1,
      segmentTotal: 5,
      slots: [],
      renderedSegment: '<segment id="S1">\n<lines>\n</lines>\n</segment>',
      flags: { allCaps: true, hiStyle: false },
      includePtExplanation: false,
    });
    expect(message).toContain('series: unknown\nepisode: S03E12\nblock: S1 (1 of 5)\n');
    expect(message).toContain('note: The dialogue is in ALL CAPS.');
    expect(message).toContain('note: Set "explanation_pt" to an empty string.');
  });
});
