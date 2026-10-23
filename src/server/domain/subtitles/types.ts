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

// ---------------------------------------------------------------------------
// Pipeline do item 7 (docs/07 §7.1)
// ---------------------------------------------------------------------------
import type { ParserStats, QaGate, QaResult } from '@shared/types/subtitles';

export type { ParserStats, QaGate, QaResult };

export type Cue = { idx: number; startMs: number; endMs: number; lines: string[] };
export type Turn = { speaker: string | null; text: string }; // uma fala dentro de um cue
export type CleanCue = { idx: number; startMs: number; endMs: number; turns: Turn[] };
export type Line = {
  id: string; // 'L042'
  startMs: number;
  endMs: number;
  speaker: string | null; // 'MAYA' (caixa alta normalizada) ou null
  text: string; // limpo e escapado (sem < >)
  cueIdx: number[]; // cues de origem
};
export type Segment = { id: string; index: number; startMs: number; endMs: number; label: string; lineIds: string[] };
export type Transcript = {
  format: 'srt' | 'vtt';
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
  lines: Line[];
  segments: Segment[];
  flags: {
    allCaps: boolean;
    hiStyle: boolean;
    musicalHeavy: boolean;
    ocrFixed: boolean;
    mojibakeFixed: boolean;
    injectionDropped: number;
  };
  stats: ParserStats;
};
export type PipelineOptions = {
  runtimeMin: number | null; // da TMDB (QA)
  segmentTargetMin: number; // 5
  dropSungLines: boolean; // true
  ocrFix: 'auto' | 'off';
};
export type PipelineErrorCode = 'UNSUPPORTED_SUBTITLE_FORMAT' | 'DECODE_FAILED' | 'EMPTY' | 'QA_FAILED';
// `qa` vai para subtitle_selections.qa (§7.11); o detalhe do erro nunca carrega texto da legenda
export type PipelineResult =
  | { ok: true; transcript: Transcript; qa: QaResult }
  | { ok: false; error: { code: PipelineErrorCode; gate?: QaGate; detail: string }; stats?: Partial<ParserStats>; qa?: QaResult };
