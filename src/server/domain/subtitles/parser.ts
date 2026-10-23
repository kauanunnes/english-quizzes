import { SubtitleCue, SubtitleLine } from './types';

export function parseTimestampToMs(timeStr: string): number {
  // Support "00:01:23,456", "00:01:23.456", or "01:23.456"
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return Math.round((minutes * 60 + seconds) * 1000);
  }
  return 0;
}

export function formatSecondsToTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function cleanSubtitleText(raw: string): { text: string; isMusic: boolean; isHi: boolean; speaker?: string } {
  let cleaned = raw;

  // 1. Check for music symbols (♪, ♫, # at start/end)
  if (/[♪♫]/.test(cleaned) || /^#\s*.*\s*#$/.test(cleaned.trim())) {
    return { text: '', isMusic: true, isHi: false };
  }

  // 2. Remove HTML and ASS tags: <i>, </i>, <b>, <font color="...">, {\an8}, etc.
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/\{[^}]+\}/g, '');

  // 3. Remove Hearing Impaired cues like [DOOR OPENS], (GASPS), [LAUGHTER]
  // Check if entire line is an HI cue
  if (/^(\[[^\]]+\]|\([^)]+\))\s*$/.test(cleaned.trim())) {
    return { text: '', isMusic: false, isHi: true };
  }
  // Strip inline HI cues
  cleaned = cleaned.replace(/\[[^\]]+\]/g, ' ');
  cleaned = cleaned.replace(/\([^)]+\)/g, ' ');

  // 4. Extract speaker label if present (e.g. "TORI: That's awesome" or "- JADE: Stop it")
  let speaker: string | undefined;
  const speakerMatch = cleaned.match(/^[-–—]?\s*([A-Z0-9'\s]{2,15}):\s*(.*)$/);
  if (speakerMatch && speakerMatch[1] && speakerMatch[2]) {
    const candidateSpeaker = speakerMatch[1].trim();
    // Exclude false positives like "PM", "AM", "HTTP"
    if (!/^(PM|AM|HTTP|HTTPS|SCENE|EPISODE|ACT)$/i.test(candidateSpeaker)) {
      speaker = candidateSpeaker;
      cleaned = speakerMatch[2];
    }
  }

  // Strip leading dialogue dashes (- or --)
  cleaned = cleaned.replace(/^[-–—]\s*/, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return { text: cleaned, isMusic: false, isHi: false, speaker };
}

export function parseSrtOrVtt(content: string): {
  cues: SubtitleCue[];
  lines: SubtitleLine[];
  removedHiCount: number;
  removedMusicCount: number;
} {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  const rawCues: SubtitleCue[] = [];
  let removedHiCount = 0;
  let removedMusicCount = 0;

  const timestampRegex = /(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}|\d{1,2}:\d{2}[,.]\d{2,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3}|\d{1,2}:\d{2}[,.]\d{2,3})/;

  let cueIndex = 1;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE')) {
      continue;
    }

    const lines = trimmed.split('\n');
    let timeLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (timestampRegex.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const match = lines[timeLineIdx].match(timestampRegex);
    if (!match) continue;

    const startMs = parseTimestampToMs(match[1]);
    const endMs = parseTimestampToMs(match[2]);
    const textLines = lines.slice(timeLineIdx + 1).join('\n');

    rawCues.push({
      index: cueIndex++,
      startMs,
      endMs,
      text: textLines,
    });
  }

  // Clean cues and turn into numbered dialogue lines
  const resultLines: SubtitleLine[] = [];
  let lineCounter = 1;

  for (const cue of rawCues) {
    const cleanedResult = cleanSubtitleText(cue.text);
    if (cleanedResult.isMusic) {
      removedMusicCount++;
      continue;
    }
    if (cleanedResult.isHi) {
      removedHiCount++;
      continue;
    }

    if (cleanedResult.text.length > 0) {
      const lineId = `L${String(lineCounter).padStart(3, '0')}`;
      resultLines.push({
        id: lineId,
        index: lineCounter++,
        startSeconds: Math.round((cue.startMs / 1000) * 10) / 10,
        endSeconds: Math.round((cue.endMs / 1000) * 10) / 10,
        speaker: cleanedResult.speaker,
        text: cleanedResult.text,
      });
    }
  }

  return {
    cues: rawCues,
    lines: resultLines,
    removedHiCount,
    removedMusicCount,
  };
}
