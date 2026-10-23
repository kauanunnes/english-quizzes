import { describe, it, expect } from 'vitest';
import { segmentLines } from '@server/domain/subtitles/segment';
import { buildLines } from '@server/domain/subtitles/merge';
import type { Line } from '@server/domain/subtitles/types';
import { continuousCues } from './helpers';

function linesFrom(totalSec: number, opts: Parameters<typeof continuousCues>[1] = {}): Line[] {
  return buildLines(
    continuousCues(totalSec, opts).map(([start, end, text], i) => ({
      idx: i + 1,
      startMs: Math.round(start * 1000),
      endMs: Math.round(end * 1000),
      turns: [{ speaker: null, text }],
    }))
  );
}

describe('Montagem de linhas (§7.9)', () => {
  it('M07: IDs L001… em ordem, com tempo, falante e cue de origem', () => {
    const lines = buildLines([
      { idx: 7, startMs: 1000, endMs: 3000, turns: [{ speaker: 'MAYA', text: 'Hi.' }, { speaker: null, text: 'Hello.' }] },
      { idx: 8, startMs: 4000, endMs: 5000, turns: [{ speaker: null, text: 'Bye.' }] },
    ]);
    expect(lines).toEqual([
      { id: 'L001', startMs: 1000, endMs: 3000, speaker: 'MAYA', text: 'Hi.', cueIdx: [7] },
      { id: 'L002', startMs: 1000, endMs: 3000, speaker: null, text: 'Hello.', cueIdx: [7] },
      { id: 'L003', startMs: 4000, endMs: 5000, speaker: null, text: 'Bye.', cueIdx: [8] },
    ]);
  });

  it('MRG-11: mais de 999 linhas usam 4 dígitos', () => {
    const cues = Array.from({ length: 1200 }, (_, i) => ({
      idx: i + 1,
      startMs: i * 1000,
      endMs: i * 1000 + 800,
      turns: [{ speaker: null, text: `Line ${i}` }],
    }));
    const lines = buildLines(cues);
    expect(lines[0].id).toBe('L0001');
    expect(lines.at(-1)?.id).toBe('L1200');
  });
});

describe('Segmentação (§7.10)', () => {
  it('SEG-01: 22 min com pausas de 4 s em 5:30, 11:05 e 16:40 dão 4 blocos cortados nessas pausas', () => {
    const pauses = [330, 665, 1000];
    const lines = linesFrom(22 * 60, { pausesAt: pauses, pauseSec: 4 });
    const segments = segmentLines(lines);

    expect(segments.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4']);
    // Cada corte cai na maior pausa: o bloco seguinte começa ~4 s depois do fim do anterior
    for (let i = 1; i < segments.length; i++) {
      const gap = segments[i].startMs - segments[i - 1].endMs;
      expect(gap).toBeGreaterThanOrEqual(4000);
      expect(Math.abs(segments[i - 1].endMs - pauses[i - 1] * 1000)).toBeLessThanOrEqual(5000);
    }
  });

  it('SEG-04: 11 min dão 3 blocos (mínimo)', () => {
    expect(segmentLines(linesFrom(11 * 60))).toHaveLength(3);
  });

  it('S05: o bloco 1 começa em 0 e os blocos cobrem todas as linhas uma vez, em ordem', () => {
    const lines = linesFrom(22 * 60);
    const segments = segmentLines(lines);
    expect(segments[0].startMs).toBe(0);
    expect(segments.flatMap((s) => s.lineIds)).toEqual(lines.map((l) => l.id));
  });

  it('S07: rótulos mm:ss–mm:ss com segundos truncados', () => {
    const segments = segmentLines(linesFrom(22 * 60));
    expect(segments[0].label).toMatch(/^00:00–\d{2}:\d{2}$/);
  });

  it('SEG-06: a mesma entrada dá saídas idênticas', () => {
    const lines = linesFrom(22 * 60, { pausesAt: [330, 665, 1000] });
    expect(segmentLines(lines)).toEqual(segmentLines(lines));
  });
});
