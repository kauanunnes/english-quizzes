import { decodeBytes, normalizeText, controlCharRatio } from './decode';
import { detectFormat } from './detect';
import { parseSrt } from './parseSrt';
import { normalizeCues } from './normalize';
import { cleanCues } from './clean';
import { buildLines } from './merge';
import { segmentLines } from './segment';
import { runQa } from './qa';
import type { Line, ParserStats, PipelineErrorCode, PipelineOptions, PipelineResult } from './types';

const countWords = (lines: Line[]) => lines.reduce((sum, l) => sum + l.text.split(/\s+/).filter(Boolean).length, 0);

// R20: proporção de letras maiúsculas (só sinaliza; o texto não muda)
function upperRatio(lines: Line[]): number {
  let letters = 0;
  let upper = 0;
  for (const { text } of lines) {
    for (const ch of text) {
      if (!/[A-Za-z]/.test(ch)) continue;
      letters++;
      if (ch === ch.toUpperCase()) upper++;
    }
  }
  return letters ? upper / letters : 0;
}

// docs/07 §7.1 — bytes → transcript em memória. Nunca lança: falhas viram { ok: false } (PBT-01)
export function processSubtitle(bytes: Uint8Array, opts: PipelineOptions): PipelineResult {
  const stats: ParserStats = {
    bytes: bytes.length,
    cuesIn: 0,
    cuesOut: 0,
    linesOut: 0,
    wordsOut: 0,
    durationMs: 0,
    controlCharRatio: 0,
    fixedTiming: 0,
    dropped: {},
  };
  const fail = (code: PipelineErrorCode, detail: string): PipelineResult => ({ ok: false, error: { code, detail }, stats });

  try {
    const decoded = decodeBytes(bytes);
    const text = normalizeText(decoded.text);
    stats.controlCharRatio = controlCharRatio(text);

    const format = detectFormat(text);
    if (format === 'vtt') return fail('UNSUPPORTED_SUBTITLE_FORMAT', 'VTT entra na Fase 3');
    if (format !== 'srt') return fail('UNSUPPORTED_SUBTITLE_FORMAT', 'formato de legenda não reconhecido');

    const parsed = parseSrt(text);
    stats.cuesIn = parsed.length;
    const cues = normalizeCues(parsed, stats);
    const cleaned = cleanCues(cues, { dropSungLines: opts.dropSungLines });
    const lines = buildLines(cleaned.cues);

    stats.dropped = cleaned.dropped;
    stats.cuesOut = cleaned.cues.length;
    stats.linesOut = lines.length;
    stats.wordsOut = countWords(lines);
    stats.durationMs = lines.at(-1)?.endMs ?? 0;

    if (lines.length === 0) return fail('EMPTY', 'nenhuma fala depois da limpeza');

    const qa = runQa(lines, opts.runtimeMin);
    if (!qa.passed) {
      return { ok: false, error: { code: 'QA_FAILED', gate: qa.failedGate ?? undefined, detail: `reprovada no gate ${qa.failedGate}` }, stats, qa };
    }

    return {
      ok: true,
      qa,
      transcript: {
        format: 'srt',
        encoding: decoded.encoding,
        lines,
        segments: segmentLines(lines, { targetMin: opts.segmentTargetMin }),
        flags: {
          allCaps: upperRatio(lines) > 0.6,
          hiStyle: cleaned.descriptionsRemoved >= 10 || cleaned.speakerLabels >= 10,
          musicalHeavy: stats.cuesIn > 0 && cleaned.sungCues / stats.cuesIn > 0.5,
          ocrFixed: false,
          mojibakeFixed: false,
          injectionDropped: 0,
        },
        stats,
      },
    };
  } catch {
    return fail('DECODE_FAILED', 'falha ao processar o arquivo');
  }
}
