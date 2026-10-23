import { SubtitleLine } from './types';

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
