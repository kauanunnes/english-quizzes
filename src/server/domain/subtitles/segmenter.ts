import { SubtitleLine, SubtitleSegment } from './types';
import { formatSecondsToTime } from './parser';

export interface SegmenterOptions {
  targetMinutes?: number; // default 5
  windowSeconds?: number; // default 60
  minFinalSegmentSeconds?: number; // default 120
  contextLinesCount?: number; // default 15
}

export function segmentDialogueLines(
  lines: SubtitleLine[],
  options: SegmenterOptions = {}
): SubtitleSegment[] {
  if (lines.length === 0) return [];

  const targetSec = (options.targetMinutes ?? 5) * 60;
  const windowSec = options.windowSeconds ?? 60;
  const minFinalSec = options.minFinalSegmentSeconds ?? 120;
  const contextCount = options.contextLinesCount ?? 15;

  const totalDuration = lines[lines.length - 1].endSeconds;

  // If the entire episode is short (e.g. <= targetSec + minFinalSec), it's just 1 segment
  if (totalDuration <= targetSec + minFinalSec) {
    return [
      {
        id: 'S1',
        index: 1,
        startSeconds: lines[0].startSeconds,
        endSeconds: totalDuration,
        formattedStart: formatSecondsToTime(lines[0].startSeconds),
        formattedEnd: formatSecondsToTime(totalDuration),
        lines,
        contextLines: [],
      },
    ];
  }

  const segments: SubtitleSegment[] = [];
  let currentStartIndex = 0;
  let segmentIndex = 1;
  let prevSegmentLines: SubtitleLine[] = [];

  while (currentStartIndex < lines.length) {
    const segmentStartSeconds = lines[currentStartIndex].startSeconds;
    const targetCutSeconds = segmentStartSeconds + targetSec;
    const remainingTime = totalDuration - targetCutSeconds;

    // Check if remaining would be too short to justify another segment
    if (remainingTime < minFinalSec) {
      // Consume all remaining lines into this final segment
      const segLines = lines.slice(currentStartIndex);
      const segEnd = segLines[segLines.length - 1].endSeconds;
      segments.push({
        id: `S${segmentIndex}`,
        index: segmentIndex,
        startSeconds: segLines[0].startSeconds,
        endSeconds: segEnd,
        formattedStart: formatSecondsToTime(segLines[0].startSeconds),
        formattedEnd: formatSecondsToTime(segEnd),
        lines: segLines,
        contextLines: prevSegmentLines.slice(-contextCount),
      });
      break;
    }

    // Find candidate pause cuts within [targetCutSeconds - windowSec, targetCutSeconds + windowSec]
    const minCut = targetCutSeconds - windowSec;
    const maxCut = targetCutSeconds + windowSec;

    let bestCutIndex = -1;
    let maxPauseSeconds = -1;

    for (let i = currentStartIndex; i < lines.length - 1; i++) {
      const lineTime = lines[i].endSeconds;
      if (lineTime < minCut) continue;
      if (lineTime > maxCut) break;

      const pause = lines[i + 1].startSeconds - lines[i].endSeconds;
      if (pause > maxPauseSeconds) {
        maxPauseSeconds = pause;
        bestCutIndex = i + 1; // slice end index
      }
    }

    // If no pause found in window, cut at the closest line to targetCutSeconds
    if (bestCutIndex === -1) {
      let closestDiff = Infinity;
      for (let i = currentStartIndex; i < lines.length; i++) {
        const diff = Math.abs(lines[i].endSeconds - targetCutSeconds);
        if (diff < closestDiff) {
          closestDiff = diff;
          bestCutIndex = i + 1;
        }
      }
    }

    // Safety check
    if (bestCutIndex <= currentStartIndex) {
      bestCutIndex = Math.min(currentStartIndex + 20, lines.length);
    }

    const segLines = lines.slice(currentStartIndex, bestCutIndex);
    const segEnd = segLines[segLines.length - 1].endSeconds;

    segments.push({
      id: `S${segmentIndex}`,
      index: segmentIndex,
      startSeconds: segLines[0].startSeconds,
      endSeconds: segEnd,
      formattedStart: formatSecondsToTime(segLines[0].startSeconds),
      formattedEnd: formatSecondsToTime(segEnd),
      lines: segLines,
      contextLines: prevSegmentLines.slice(-contextCount),
    });

    prevSegmentLines = segLines;
    currentStartIndex = bestCutIndex;
    segmentIndex++;
  }

  return segments;
}
