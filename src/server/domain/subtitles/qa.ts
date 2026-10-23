import type { Line } from './types';
import { QA_MIN_LINES, QA_MIN_LINES_PER_MIN } from './rules';
import type { QaResult } from '@shared/types/subtitles';

// docs/07 §7.11 — Fase 1: só Q01 (mínimo de linhas). Q02–Q07 entram na Fase 3.
export function runQa(lines: Line[], runtimeMin: number | null): QaResult {
  const threshold = Math.max(QA_MIN_LINES, runtimeMin ? QA_MIN_LINES_PER_MIN * runtimeMin : 0);
  const q01 = { passed: lines.length >= threshold, value: lines.length, threshold };
  return { passed: q01.passed, failedGate: q01.passed ? null : 'Q01', gates: { Q01: q01 } };
}
