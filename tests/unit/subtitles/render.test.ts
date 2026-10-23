import { describe, it, expect } from 'vitest';
import { renderSegment, renderLine } from '@server/domain/subtitles/render';
import { segmentLines } from '@server/domain/subtitles/segment';
import { buildLines } from '@server/domain/subtitles/merge';
import { continuousCues } from './helpers';

function transcriptLines() {
  return buildLines(
    continuousCues(22 * 60).map(([start, end, text], i) => ({
      idx: i + 1,
      startMs: Math.round(start * 1000),
      endMs: Math.round(end * 1000),
      turns: [{ speaker: i % 2 === 0 ? 'MAYA' : null, text }],
    }))
  );
}

describe('Renderização para a LLM (§7.12)', () => {
  it('RND-01: linha com falante', () => {
    expect(renderLine({ id: 'L058', startMs: 0, endMs: 1, speaker: 'MAYA', text: 'Did you finish the script?', cueIdx: [1] })).toBe(
      'L058 [MAYA]: Did you finish the script?'
    );
    expect(renderLine({ id: 'L059', startMs: 0, endMs: 1, speaker: null, text: 'Not yet.', cueIdx: [2] })).toBe('L059: Not yet.');
  });

  it('RND-02: o bloco S2 tem como contexto as 15 últimas linhas de S1 e nenhuma linha de S3', () => {
    const lines = transcriptLines();
    const segments = segmentLines(lines);
    const rendered = renderSegment(lines, segments, 'S2');

    const contextIds = [...rendered.matchAll(/^(L\d{3,4})/gm)].map((m) => m[1]);
    const s1 = segments[0].lineIds;
    const s2 = segments[1].lineIds;
    expect(contextIds).toEqual([...s1.slice(-15), ...s2]);
    for (const id of segments[2].lineIds) expect(rendered).not.toContain(id);

    expect(rendered.startsWith('<segment id="S2">\n<context>\n')).toBe(true);
    expect(rendered).toContain('</context>\n<lines>\n');
    expect(rendered.endsWith('</lines>\n</segment>')).toBe(true);
  });

  it('RND-03: o bloco S1 não tem <context>', () => {
    const lines = transcriptLines();
    const rendered = renderSegment(lines, segmentLines(lines), 'S1');
    expect(rendered).not.toContain('<context>');
    expect(rendered.startsWith('<segment id="S1">\n<lines>\n')).toBe(true);
  });
});
