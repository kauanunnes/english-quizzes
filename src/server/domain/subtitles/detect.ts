import { TIMING_SRT } from './rules';

// docs/07 §7.4; null = UNSUPPORTED_SUBTITLE_FORMAT (F03, F04, F05)
export function detectFormat(text: string): 'srt' | 'vtt' | null {
  const lines = text.split('\n');
  const firstNonEmpty = lines.find((l) => l.trim() !== '');
  if (firstNonEmpty?.trimStart().startsWith('WEBVTT')) return 'vtt'; // F01
  if (/^\s*\[Script Info\]/m.test(text) || /^\s*Dialogue:/m.test(text)) return null; // F03
  if (/^\s*\{\d+\}\{\d+\}/m.test(text)) return null; // F04

  let timingLines = 0;
  for (const line of lines) {
    if (TIMING_SRT.test(line) && ++timingLines >= 3) return 'srt'; // F02
  }
  return null; // F05
}
