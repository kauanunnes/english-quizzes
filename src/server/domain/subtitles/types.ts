export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SubtitleLine {
  id: string; // ex: "L001"
  index: number;
  startSeconds: number;
  endSeconds: number;
  speaker?: string;
  text: string;
}

export interface SubtitleSegment {
  id: string; // ex: "S1"
  index: number;
  startSeconds: number;
  endSeconds: number;
  formattedStart: string;
  formattedEnd: string;
  lines: SubtitleLine[];
  contextLines: SubtitleLine[]; // Últimas ~15 linhas do bloco anterior
}

export interface SubtitleParseResult {
  lines: SubtitleLine[];
  totalCues: number;
  removedHiCount: number;
  removedMusicCount: number;
  durationSeconds: number;
  segments: SubtitleSegment[];
}
