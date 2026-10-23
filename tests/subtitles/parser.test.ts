import { describe, it, expect } from 'vitest';
import { parseSrtOrVtt, cleanSubtitleText } from '@server/domain/subtitles/parser';
import { segmentDialogueLines } from '@server/domain/subtitles/segmenter';
import { evaluateSubtitleQuality } from '@server/domain/subtitles/qa';

describe('Subtitle Cleaner', () => {
  it('removes HTML and ASS tags', () => {
    const raw = '<i>Hello</i> <b>world</b> <font color="red">test</font> {\\an8}done';
    const result = cleanSubtitleText(raw);
    expect(result.text).toBe('Hello world test done');
    expect(result.isMusic).toBe(false);
    expect(result.isHi).toBe(false);
  });

  it('detects and removes music lines with ♪ or #', () => {
    expect(cleanSubtitleText('♪ Lalala ♪').isMusic).toBe(true);
    expect(cleanSubtitleText('♫ Singing in the rain ♫').isMusic).toBe(true);
    expect(cleanSubtitleText('# Song lyrics #').isMusic).toBe(true);
  });

  it('detects and removes Hearing Impaired sound cues', () => {
    expect(cleanSubtitleText('[DOOR CREAKS]').isHi).toBe(true);
    expect(cleanSubtitleText('(LAUGHTER)').isHi).toBe(true);
    expect(cleanSubtitleText('Hey [SIGHS] what are you doing?').text).toBe('Hey what are you doing?');
  });

  it('extracts speaker names from line prefixes', () => {
    const result = cleanSubtitleText('TORI: Hey, have you seen Andre?');
    expect(result.speaker).toBe('TORI');
    expect(result.text).toBe('Hey, have you seen Andre?');
  });

  it('strips leading dialogue dashes', () => {
    expect(cleanSubtitleText('- Hi there').text).toBe('Hi there');
    expect(cleanSubtitleText('— How are you?').text).toBe('How are you?');
  });
});

describe('SRT and VTT Parser', () => {
  const sampleSrt = `
1
00:00:01,000 --> 00:00:03,500
[UPBEAT MUSIC]

2
00:00:04,000 --> 00:00:06,000
TORI: Hey guys, check this out!

3
00:00:06,500 --> 00:00:09,000
♪ Make it shine ♪

4
00:00:09,500 --> 00:00:12,000
ANDRE: That song sounds unbelievable.
`;

  it('correctly parses cues and produces numbered lines', () => {
    const parsed = parseSrtOrVtt(sampleSrt);
    expect(parsed.lines).toHaveLength(2); // Only Tori and Andre dialogue, skipping music/HI
    expect(parsed.removedHiCount).toBe(1);
    expect(parsed.removedMusicCount).toBe(1);

    expect(parsed.lines[0].id).toBe('L001');
    expect(parsed.lines[0].speaker).toBe('TORI');
    expect(parsed.lines[0].text).toBe('Hey guys, check this out!');
    expect(parsed.lines[0].startSeconds).toBe(4);

    expect(parsed.lines[1].id).toBe('L002');
    expect(parsed.lines[1].speaker).toBe('ANDRE');
    expect(parsed.lines[1].text).toBe('That song sounds unbelievable.');
  });
});

describe('Subtitle Segmenter', () => {
  it('segments lines into ~5 minute blocks', () => {
    const fakeLines = Array.from({ length: 100 }, (_, i) => ({
      id: `L${String(i + 1).padStart(3, '0')}`,
      index: i + 1,
      startSeconds: i * 10,
      endSeconds: i * 10 + 5,
      text: `Line of dialogue number ${i + 1}`,
    }));

    const segments = segmentDialogueLines(fakeLines, { targetMinutes: 5 });
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].id).toBe('S1');
    expect(segments[0].formattedStart).toBe('00:00');
    expect(segments[1].contextLines.length).toBeGreaterThan(0);
  });
});

describe('Subtitle QA', () => {
  it('flags subtitles that are too short or lacking dialogue', () => {
    const result = evaluateSubtitleQuality([], 22);
    expect(result.passed).toBe(false);
  });
});
