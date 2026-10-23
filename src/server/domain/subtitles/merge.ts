import type { CleanCue, Line } from './types';

// docs/07 §7.9 — Fase 1: cada turno vira uma linha (M01 já aconteceu na limpeza) e recebe o ID (M07).
// Fusões entre cues (M02–M06) entram na Fase 3.
export function buildLines(cues: CleanCue[]): Line[] {
  const flat = cues.flatMap((cue) =>
    cue.turns.map((turn) => ({
      startMs: cue.startMs,
      endMs: cue.endMs,
      speaker: turn.speaker,
      text: turn.text,
      cueIdx: [cue.idx],
    }))
  );

  // M07: L001… ou L0001… quando passar de 999 linhas
  const width = flat.length > 999 ? 4 : 3;
  return flat.map((line, i) => ({ id: `L${String(i + 1).padStart(width, '0')}`, ...line }));
}
