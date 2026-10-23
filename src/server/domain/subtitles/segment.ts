import type { Line, Segment } from './types';

export type SegmentOptions = { targetMin: number; windowS: number; minLines: number; minLastMin: number };

const DEFAULTS: SegmentOptions = { targetMin: 5, windowS: 60, minLines: 8, minLastMin: 2 };

// docs/07 §7.10 — S01 a S05 e S07. A fusão de blocos pequenos (S06) entra na Fase 3.
export function segmentLines(lines: Line[], options: Partial<SegmentOptions> = {}): Segment[] {
  if (lines.length === 0) return [];
  const o = { ...DEFAULTS, ...options };

  const duration = lines[lines.length - 1].endMs; // S01
  const n = Math.max(3, Math.round(duration / (o.targetMin * 60_000))); // S02
  const cuts: number[] = []; // índice da última linha de cada bloco, exceto o último

  for (let k = 1; k < n; k++) {
    const from = (cuts.at(-1) ?? -1) + 1;
    if (from >= lines.length - 1) break; // não sobram linhas para mais um bloco

    const ideal = (k * duration) / n; // S03
    const lo = ideal - o.windowS * 1000;
    const hi = ideal + o.windowS * 1000;
    let best = -1;
    let bestGap = -1;
    let bestDist = Infinity;

    // S04: maior pausa entre as linhas cujo fim cai na janela; empate → mais perto do ideal
    for (let i = from; i < lines.length - 1; i++) {
      const end = lines[i].endMs;
      if (end < lo) continue;
      if (end > hi) break;
      const gap = Math.max(0, lines[i + 1].startMs - end);
      const dist = Math.abs(end - ideal);
      if (gap > bestGap || (gap === bestGap && dist < bestDist)) {
        best = i;
        bestGap = gap;
        bestDist = dist;
      }
    }
    cuts.push(best >= 0 ? best : nearestLineEnd(lines, ideal, from));
  }

  return buildSegments(lines, cuts, duration >= 3_600_000);
}

function nearestLineEnd(lines: Line[], ideal: number, from: number): number {
  let best = from;
  for (let i = from + 1; i < lines.length - 1; i++) {
    if (Math.abs(lines[i].endMs - ideal) < Math.abs(lines[best].endMs - ideal)) best = i;
  }
  return best;
}

// S05: bloco 1 começa em 0; os demais no início da 1ª linha; cada um termina no fim da última
function buildSegments(lines: Line[], cuts: number[], withHours: boolean): Segment[] {
  const bounds = [...cuts, lines.length - 1];
  let first = 0;
  return bounds.map((last, i) => {
    const slice = lines.slice(first, last + 1);
    const startMs = i === 0 ? 0 : slice[0].startMs;
    const endMs = slice[slice.length - 1].endMs;
    first = last + 1;
    return {
      id: `S${i + 1}`,
      index: i + 1,
      startMs,
      endMs,
      label: `${clock(startMs, withHours)}–${clock(endMs, withHours)}`,
      lineIds: slice.map((l) => l.id),
    };
  });
}

// S07: mm:ss com segundos truncados; episódios a partir de 1 h usam h:mm:ss
export function clock(ms: number, withHours = false): string {
  const total = Math.floor(ms / 1000);
  const ss = String(total % 60).padStart(2, '0');
  if (withHours) {
    return `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${ss}`;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${ss}`;
}
