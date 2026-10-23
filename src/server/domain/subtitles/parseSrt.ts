import { TIMING_SRT } from './rules';
import type { Cue } from './types';

const DIGITS_ONLY = /^\d+$/;

// `,5` = 500 ms; `,50` = 500 ms; `,500` = 500 ms; ausente = 0
function toMs(h: string, m: string, s: string, frac: string | undefined): number {
  const ms = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + ms;
}

// docs/07 §7.5 — a âncora é a linha de tempo; linha em branco não fecha o cue
export function parseSrt(text: string): Cue[] {
  const lines = text.split('\n');
  const cues: Cue[] = [];
  let current: Cue | null = null;

  const nextNonEmpty = (from: number) => {
    for (let j = from; j < lines.length; j++) {
      if (lines[j].trim() !== '') return lines[j];
    }
    return undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timing = TIMING_SRT.exec(line);

    if (timing) {
      if (current) cues.push(current);

      const previous = i > 0 ? lines[i - 1].trim() : '';
      let idx = cues.length + 1;
      if (DIGITS_ONLY.test(previous)) {
        idx = Number(previous);
        // O índice pode ter sido anexado como texto do cue anterior
        const last = cues.at(-1);
        if (last && last.lines.at(-1) === previous) last.lines.pop();
      }

      current = {
        idx,
        startMs: toMs(timing[1], timing[2], timing[3], timing[4]),
        endMs: toMs(timing[5], timing[6], timing[7], timing[8]),
        lines: [],
      };
      continue;
    }

    if (!current) continue;
    const trimmed = line.trim();
    if (trimmed === '') continue; // "possível fim"
    const next = nextNonEmpty(i + 1);
    if (DIGITS_ONLY.test(trimmed) && next !== undefined && TIMING_SRT.test(next)) continue; // índice do próximo cue
    current.lines.push(trimmed);
  }

  if (current) cues.push(current);
  return cues;
}
