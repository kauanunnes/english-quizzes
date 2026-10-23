import { readFileSync } from 'node:fs';
import type { Line, Segment, Transcript } from '@server/domain/subtitles/types';

// Linhas do exemplo do §8.12 (falas inventadas): L041–L042 formam o S1 e L043–L054 o S2
export function exampleTranscript(): { lines: Line[]; segments: Segment[]; flags: Transcript['flags'] } {
  const input = readFileSync('tests/fixtures/llm/example-S2.input.txt', 'utf8');
  const lines: Line[] = [...input.matchAll(/^(L\d{3}) \[([^\]]+)\]: (.+)$/gm)].map((m, i) => ({
    id: m[1],
    startMs: 300_000 + i * 5_000,
    endMs: 300_000 + i * 5_000 + 4_000,
    speaker: m[2],
    text: m[3],
    cueIdx: [i + 1],
  }));
  const s1 = lines.filter((l) => l.id < 'L043');
  const s2 = lines.filter((l) => l.id >= 'L043');
  const segments: Segment[] = [
    { id: 'S1', index: 1, startMs: 0, endMs: s1.at(-1)!.endMs, label: '00:00–05:09', lineIds: s1.map((l) => l.id) },
    { id: 'S2', index: 2, startMs: s2[0].startMs, endMs: s2.at(-1)!.endMs, label: '05:10–06:09', lineIds: s2.map((l) => l.id) },
  ];
  const flags = { allCaps: false, hiStyle: true, musicalHeavy: false, ocrFixed: false, mojibakeFixed: false, injectionDropped: 0 };
  return { lines, segments, flags };
}

export function exampleOutput(): Record<string, unknown> & { questions: Record<string, unknown>[] } {
  return JSON.parse(readFileSync('tests/fixtures/llm/example-S2.output.json', 'utf8'));
}
