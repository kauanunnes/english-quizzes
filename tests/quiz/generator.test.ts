import { describe, it, expect } from 'vitest';
import { generateQuizForEpisode } from '@server/domain/quiz/generator';
import { fakeLlmProvider } from '@server/integrations/llm/fake';
import { SubtitleSegment } from '@server/domain/subtitles/types';

describe('Quiz Generator', () => {
  const sampleSegment: SubtitleSegment = {
    id: 'S1',
    index: 1,
    startSeconds: 0,
    endSeconds: 300,
    formattedStart: '00:00',
    formattedEnd: '05:00',
    lines: [
      { id: 'L001', index: 1, startSeconds: 5, endSeconds: 8, speaker: 'TORI', text: 'Hey guys, check this out!' },
      { id: 'L002', index: 2, startSeconds: 10, endSeconds: 14, speaker: 'ANDRE', text: 'That song sounds unbelievable.' },
      { id: 'L003', index: 3, startSeconds: 20, endSeconds: 25, speaker: 'JADE', text: 'I really doubt you can pull this off.' },
      { id: 'L004', index: 4, startSeconds: 30, endSeconds: 35, speaker: 'BECK', text: 'Come on Jade, give her a chance.' },
    ],
    contextLines: [],
  };

  it('generates a full quiz document using the fake provider', async () => {
    const quiz = await generateQuizForEpisode({
      jobId: 'job_test_1',
      seriesId: 1234,
      seriesTitle: 'Victorious',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: 'Pilot',
      runtimeMinutes: 22,
      segments: [sampleSegment],
      provider: fakeLlmProvider,
    });

    expect(quiz.episodeKey).toBe('tmdb-1234-s01-e01');
    expect(quiz.seriesTitle).toBe('Victorious');
    expect(quiz.segments).toHaveLength(1);
    expect(quiz.segments[0].questions.length).toBeGreaterThan(0);

    const firstQuestion = quiz.segments[0].questions[0];
    expect(firstQuestion.evidence.lineIds).toBeDefined();
    expect(firstQuestion.evidence.approxTimeSeconds).toBeDefined();
    expect(firstQuestion.explanation).toBeDefined();
    expect(firstQuestion.explanationPt).toBeDefined();
  });
});
