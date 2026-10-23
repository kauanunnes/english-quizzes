import { SubtitleLine, Line } from './types';
import { QA_MIN_LINES, QA_MIN_LINES_PER_MIN } from './rules';
import type { QaResult } from '@shared/types/subtitles';

// docs/07 §7.11 — Fase 1: só Q01 (mínimo de linhas). Q02–Q07 entram na Fase 3.
export function runQa(lines: Line[], runtimeMin: number | null): QaResult {
  const threshold = Math.max(QA_MIN_LINES, runtimeMin ? QA_MIN_LINES_PER_MIN * runtimeMin : 0);
  const q01 = { passed: lines.length >= threshold, value: lines.length, threshold };
  return { passed: q01.passed, failedGate: q01.passed ? null : 'Q01', gates: { Q01: q01 } };
}

export interface QaReport {
  passed: boolean;
  reason?: string;
  totalLines: number;
  durationSeconds: number;
  speechRateWordsPerMinute: number;
}

export function evaluateSubtitleQuality(
  lines: SubtitleLine[],
  expectedRuntimeMinutes?: number
): QaReport {
  if (lines.length < 50) {
    return {
      passed: false,
      reason: `Too few dialogue lines (${lines.length} < 50). Subtitle might be incomplete or intro-only.`,
      totalLines: lines.length,
      durationSeconds: lines.length > 0 ? lines[lines.length - 1].endSeconds : 0,
      speechRateWordsPerMinute: 0,
    };
  }

  const durationSeconds = lines[lines.length - 1].endSeconds;

  if (expectedRuntimeMinutes && expectedRuntimeMinutes > 0) {
    const expectedSec = expectedRuntimeMinutes * 60;
    // Only a subtitle much shorter than the runtime is rejected (incomplete file or intro-only)
    const minSec = expectedSec * 0.55;

    if (durationSeconds < minSec) {
      return {
        passed: false,
        reason: `Subtitle duration (${Math.round(durationSeconds / 60)}m) is much shorter than expected episode runtime (${expectedRuntimeMinutes}m).`,
        totalLines: lines.length,
        durationSeconds,
        speechRateWordsPerMinute: 0,
      };
    }
  }

  const totalWords = lines.reduce((acc, l) => acc + l.text.split(/\s+/).length, 0);
  const durationMinutes = durationSeconds / 60;
  const wordsPerMinute = durationMinutes > 0 ? Math.round(totalWords / durationMinutes) : 0;

  // Typical TV dialogue is ~100-200 WPM
  if (wordsPerMinute < 30) {
    return {
      passed: false,
      reason: `Speech rate is abnormally low (${wordsPerMinute} wpm).`,
      totalLines: lines.length,
      durationSeconds,
      speechRateWordsPerMinute: wordsPerMinute,
    };
  }

  return {
    passed: true,
    totalLines: lines.length,
    durationSeconds,
    speechRateWordsPerMinute: wordsPerMinute,
  };
}
