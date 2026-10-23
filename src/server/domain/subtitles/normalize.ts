import type { Cue } from './types';

// docs/07 §7.6 — N01, N02 e N04 (N03 é só uma convenção para calcular pausas)
export function normalizeCues(cues: Cue[], stats: { fixedTiming: number }): Cue[] {
  return cues
    .filter((cue) => cue.lines.some((line) => line.trim() !== '')) // N04
    .map((cue) => {
      if (cue.endMs >= cue.startMs) return cue;
      stats.fixedTiming++; // N02
      return { ...cue, endMs: cue.startMs + 1000 };
    })
    .sort((a, b) => a.startMs - b.startMs); // N01 (sort estável)
}
