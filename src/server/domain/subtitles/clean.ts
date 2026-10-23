import {
  R01_TAGS,
  R01_BR,
  R01_RT,
  R01_VOICE,
  R01_VOICE_END,
  R01_KARAOKE,
  R02_BRACES,
  R02_ASS_BREAK,
  R02_ASS_SPACE,
  R04_ADS_STRONG,
  R06_BRACKETS,
  R07_PARENS,
  R10_SUNG,
  R11_CAPS_SPEAKER,
  R13_DASH,
  SPEAKER_STOPLIST,
  HAS_LETTER,
} from './rules';
import type { CleanCue, Cue, Turn } from './types';
import type { RuleId } from '@shared/types/subtitles';

// docs/07 §7.7. Fase 1: R01, R02, R03, R04, R06, R07, R10, R11, R13 (+M01), R16, R18 e R19.
// R05, R08, R09, R12, R14, R15, R17 e R20 (como alteração) entram na Fase 3.

export type CleanOptions = { dropSungLines: boolean };

export type CleanResult = {
  cues: CleanCue[];
  dropped: Partial<Record<RuleId, number>>;
  descriptionsRemoved: number; // R06/R07, para flags.hiStyle
  speakerLabels: number;
  sungCues: number; // para flags.musicalHeavy (Q05)
};

const R01_VOICE_ALL = new RegExp(R01_VOICE.source, 'gi');

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  rsquo: '’',
};

// R03
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// R01 → R02 → R03, por linha
function cleanMarkup(line: string): string {
  const withoutTags = line
    .replace(R01_RT, '')
    .replace(R01_BR, ' ')
    .replace(R01_KARAOKE, '')
    .replace(R01_VOICE_ALL, '')
    .replace(R01_VOICE_END, '')
    .replace(R01_TAGS, '')
    .replace(R02_BRACES, '')
    .replace(R02_ASS_BREAK, ' ')
    .replace(R02_ASS_SPACE, ' ');
  return decodeEntities(withoutTags);
}

// R18
function tidy(text: string): string {
  return text
    .replace(/…/g, '...')
    .replace(/\.{4,}/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/\s+([?!.,;:])/g, '$1')
    .trim();
}

export function cleanCues(cues: Cue[], options: CleanOptions): CleanResult {
  const result: CleanResult = { cues: [], dropped: {}, descriptionsRemoved: 0, speakerLabels: 0, sungCues: 0 };
  const count = (rule: RuleId, n = 1) => {
    result.dropped[rule] = (result.dropped[rule] ?? 0) + n;
  };

  // Por turno: falante (R11) → descrições (R06, R07) → escape (R16) → espaços (R18) → sem letras (R19)
  const cleanTurn = (raw: string): Turn | null => {
    let text = raw.trim();
    let speaker: string | null = null;

    const label = R11_CAPS_SPEAKER.exec(text);
    if (label && !SPEAKER_STOPLIST.has(label[1].trim())) {
      speaker = label[1].trim().toUpperCase().slice(0, 30);
      text = text.slice(label[0].length);
      result.speakerLabels++;
    }

    const descriptions = (text.match(R06_BRACKETS)?.length ?? 0) + (text.match(R07_PARENS)?.length ?? 0);
    result.descriptionsRemoved += descriptions;
    text = text.replace(R06_BRACKETS, ' ').replace(R07_PARENS, ' ');

    text = tidy(text.replace(/</g, '‹').replace(/>/g, '›'));

    if (!HAS_LETTER.test(text)) {
      count('R19');
      return null;
    }
    return { speaker, text };
  };

  for (const cue of cues) {
    // Por cue: propaganda forte em qualquer posição (R04)
    if (R04_ADS_STRONG.some((re) => re.test(cue.lines.join(' ')))) {
      count('R04');
      continue;
    }

    // Por linha: marcação → música (R10) → travessão (R13) abre turno; o resto é anexado ao turno corrente (M01)
    const rawTurns: string[][] = [];
    let sung = false;
    for (const rawLine of cue.lines) {
      let line = cleanMarkup(rawLine);
      if (R10_SUNG.test(line)) {
        sung = true;
        if (options.dropSungLines) {
          count('R10');
          continue;
        }
        line = line.replace(/[♪♫]/g, '').replace(/^\s*#\s*|\s*#\s*$/g, '');
      }

      if (R13_DASH.test(line)) {
        rawTurns.push([line.replace(R13_DASH, '')]);
      } else if (rawTurns.length > 0) {
        rawTurns[rawTurns.length - 1].push(line);
      } else {
        rawTurns.push([line]);
      }
    }
    if (sung) result.sungCues++;

    const turns = rawTurns.map((parts) => cleanTurn(parts.join(' '))).filter((t): t is Turn => t !== null);
    if (turns.length > 0) {
      result.cues.push({ idx: cue.idx, startMs: cue.startMs, endMs: cue.endMs, turns });
    }
  }

  return result;
}
