// Fixtures sintéticas: falas inventadas (docs/07 §7.14)
export type CueSpec = [startSec: number, endSec: number, text: string];

function time(totalSec: number): string {
  const ms = Math.round(totalSec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const frac = ms % 1000;
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(frac, 3)}`;
}

export function srt(cues: CueSpec[], eol = '\n'): string {
  return cues.map(([start, end, text], i) => [String(i + 1), `${time(start)} --> ${time(end)}`, text, ''].join(eol)).join(eol);
}

export const utf8 = (text: string) => new TextEncoder().encode(text);

// Diálogo contínuo: uma fala a cada `stepSec`, com pausas maiores onde pedido
export function continuousCues(totalSec: number, opts: { stepSec?: number; pausesAt?: number[]; pauseSec?: number } = {}): CueSpec[] {
  const step = opts.stepSec ?? 5;
  const pauseSec = opts.pauseSec ?? 4;
  const pauses = [...(opts.pausesAt ?? [])];
  const cues: CueSpec[] = [];
  let t = 0;
  let n = 0;
  while (t < totalSec) {
    const end = t + step - 0.5;
    cues.push([t, end, `Line number ${++n} says something about the plan.`]);
    if (pauses.length && end >= pauses[0] - step && end <= pauses[0]) {
      pauses.shift();
      t = end + pauseSec;
    } else {
      t = end + 0.5;
    }
  }
  return cues;
}
