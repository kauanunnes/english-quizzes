import { describe, it, expect } from 'vitest';
import { parseSrt } from '@server/domain/subtitles/parseSrt';
import { normalizeCues } from '@server/domain/subtitles/normalize';
import { detectFormat } from '@server/domain/subtitles/detect';
import { srt } from './helpers';

describe('Parsing SRT (§7.5)', () => {
  it('SRT-01: arquivo com CRLF dá o mesmo resultado que LF', () => {
    const cues: [number, number, string][] = [
      [1, 2, 'Hello there.'],
      [3, 4, 'How are you?'],
    ];
    expect(parseSrt(srt(cues, '\r\n').replace(/\r\n/g, '\n'))).toEqual(parseSrt(srt(cues)));
  });

  it('SRT-02: dois cues sem linha em branco entre eles viram 2 cues', () => {
    const text = '1\n00:00:01,000 --> 00:00:02,000\nFirst line\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n';
    const cues = parseSrt(text);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ idx: 1, startMs: 1000, endMs: 2000, lines: ['First line'] });
    expect(cues[1]).toMatchObject({ idx: 2, startMs: 3000, endMs: 4000, lines: ['Second line'] });
  });

  it('SRT-03: linha em branco no meio do texto não fecha o cue', () => {
    const text = '1\n00:00:01,000 --> 00:00:02,000\nFirst part\n\nsecond part\n\n2\n00:00:03,000 --> 00:00:04,000\nNext\n';
    const cues = parseSrt(text);
    expect(cues).toHaveLength(2);
    expect(cues[0].lines).toEqual(['First part', 'second part']);
  });

  it('SRT-04: ponto antes dos milissegundos', () => {
    expect(parseSrt('1\n00:00:01.500 --> 00:00:02.000\nHi\n')[0]).toMatchObject({ startMs: 1500, endMs: 2000 });
  });

  it('SRT-05: hora com 1 dígito e milissegundos curtos', () => {
    expect(parseSrt('1\n0:00:01,5 --> 0:00:02,50\nHi\n')[0]).toMatchObject({ startMs: 1500, endMs: 2500 });
  });

  it('SRT-06: coordenadas depois do tempo são ignoradas', () => {
    const cue = parseSrt('1\n00:00:01,000 --> 00:00:02,000 X1:100 X2:500 Y1:10 Y2:50\nHi\n')[0];
    expect(cue).toMatchObject({ startMs: 1000, endMs: 2000, lines: ['Hi'] });
  });

  it('SRT-08: fala "42" sozinha, sem tempo na sequência, continua sendo texto', () => {
    const text = '1\n00:00:01,000 --> 00:00:02,000\nHow many?\n42\n\n2\n00:00:03,000 --> 00:00:04,000\nOkay\n';
    expect(parseSrt(text)[0].lines).toEqual(['How many?', '42']);
  });

  it('SRT-09 e SRT-10: fim antes do início é corrigido e cues fora de ordem são ordenados', () => {
    const stats = { fixedTiming: 0 };
    const cues = normalizeCues(
      [
        { idx: 2, startMs: 5000, endMs: 6000, lines: ['Later'] },
        { idx: 1, startMs: 1000, endMs: 500, lines: ['Earlier'] },
      ],
      stats
    );
    expect(cues.map((c) => c.idx)).toEqual([1, 2]);
    expect(cues[0].endMs).toBe(2000);
    expect(stats.fixedTiming).toBe(1);
  });

  it('SRT-11: cue sem texto é descartado', () => {
    const stats = { fixedTiming: 0 };
    expect(normalizeCues([{ idx: 1, startMs: 0, endMs: 1000, lines: ['  '] }], stats)).toEqual([]);
  });
});

describe('Detecção de formato (§7.4)', () => {
  it('FMT-01: SRT com 3 cues', () => {
    expect(detectFormat(srt([[1, 2, 'a'], [3, 4, 'b'], [5, 6, 'c']]))).toBe('srt');
  });

  it('FMT-03, FMT-04 e FMT-06: ASS, MicroDVD e texto sem tempo não são suportados', () => {
    expect(detectFormat('[Script Info]\nTitle: x\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi')).toBeNull();
    expect(detectFormat('{100}{200}Hello')).toBeNull();
    expect(detectFormat('just some text\nwithout timing')).toBeNull();
  });
});
