import { describe, it, expect } from 'vitest';
import { validateAndEnrichSegmentQuestions } from '@server/domain/quiz/validator';
import { SubtitleSegment } from '@server/domain/subtitles/types';

describe('Quiz Validator', () => {
  const longLine =
    'I told you a hundred times that the showcase starts at eight and nobody listens to me ever';

  const segment: SubtitleSegment = {
    id: 'S2',
    index: 2,
    startSeconds: 300,
    endSeconds: 600,
    formattedStart: '05:00',
    formattedEnd: '10:00',
    lines: [
      { id: 'L010', index: 10, startSeconds: 310, endSeconds: 313, speaker: 'TORI', text: "I can't believe you actually pulled that off." },
      { id: 'L011', index: 11, startSeconds: 320, endSeconds: 326, speaker: 'TRINA', text: longLine },
    ],
    contextLines: [
      { id: 'L009', index: 9, startSeconds: 290, endSeconds: 295, speaker: 'ANDRE', text: 'This line belongs to the previous block.' },
    ],
  };

  const baseQuestion = {
    id: 'q1',
    level: 'B1',
    type: 'comprehension',
    prompt: 'What is Tori surprised about?',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    evidence: { lineIds: ['L010'], text: 'you actually pulled that off' },
    explanation: 'She did not expect it to work.',
    explanationPt: 'Ela não esperava que desse certo.',
  };

  it('accepts enum values with different casing and normalizes them', () => {
    const { validQuestions, rejectedQuestions } = validateAndEnrichSegmentQuestions(
      [{ ...baseQuestion, level: 'b1', type: 'Comprehension' }],
      segment
    );

    expect(rejectedQuestions).toHaveLength(0);
    expect(validQuestions[0].level).toBe('B1');
    expect(validQuestions[0].type).toBe('comprehension');
    expect(validQuestions[0].evidence.formattedTime).toBe('≈05:10');
  });

  it('rejects evidence that cites context lines from the previous block', () => {
    const { validQuestions, rejectedQuestions } = validateAndEnrichSegmentQuestions(
      [{ ...baseQuestion, evidence: { lineIds: ['L009'], text: 'belongs to the previous block' } }],
      segment
    );

    expect(validQuestions).toHaveLength(0);
    expect(rejectedQuestions[0].reason).toContain('not found in target segment');
  });

  it('rejects quotations that do not appear in the cited lines', () => {
    const { validQuestions } = validateAndEnrichSegmentQuestions(
      [{ ...baseQuestion, evidence: { lineIds: ['L010'], text: 'we should leave the party right now' } }],
      segment
    );

    expect(validQuestions).toHaveLength(0);
  });

  it('rejects unknown levels and out-of-range answers', () => {
    const { validQuestions, rejectedQuestions } = validateAndEnrichSegmentQuestions(
      [
        { ...baseQuestion, id: 'q-level', level: 'C2' },
        { ...baseQuestion, id: 'q-index', correctIndex: 4 },
      ],
      segment
    );

    expect(validQuestions).toHaveLength(0);
    expect(rejectedQuestions).toHaveLength(2);
  });

  it('cuts long quotations down to 15 words', () => {
    const { validQuestions } = validateAndEnrichSegmentQuestions(
      [{ ...baseQuestion, evidence: { lineIds: ['L011'], text: longLine } }],
      segment
    );

    expect(validQuestions).toHaveLength(1);
    expect(validQuestions[0].evidence.text.split(' ')).toHaveLength(15);
  });
});
