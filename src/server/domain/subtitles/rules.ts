// docs/07 §7.7 — expressões das regras de limpeza (transcritas do documento)
export const TIMING_SRT = /^\s*(\d{1,2}):(\d{2}):(\d{2})(?:[,.](\d{1,3}))?\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})(?:[,.](\d{1,3}))?/;
export const TIMING_VTT = /^\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})/;

export const R01_TAGS = /<\/?(?:i|b|u|s|font|span|c|lang|ruby)(?:\.[\w.-]+)?(?:\s[^>]*)?>/gi;
export const R01_BR = /<br\s*\/?>/gi;
export const R01_RT = /<rt>[\s\S]*?<\/rt>/gi;
export const R01_VOICE = /<v(?:\.[\w.-]+)?\s+([^>]+)>/i;
export const R01_VOICE_END = /<\/v>/gi;
export const R01_KARAOKE = /<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/g;

export const R02_BRACES = /\{[^}]*\}/g;
export const R02_ASS_BREAK = /\\[Nn]/g;
export const R02_ASS_SPACE = /\\h/g;

export const R04_ADS_STRONG = [
  /opensubtitles|addic7ed|subscene|podnapisi|\byify\b|subdl\.com/i,
  /\bsub(?:title)?s?\s+(?:by|ripped by|synced by|corrected by|edited by|downloaded from|provided by)\b/i,
  /\bsync(?:ed|hronized)?\s*(?:and|&)\s*correct(?:ed|ions)?\b/i,
  /\bresync(?:ed)?\s+by\b/i,
  /\btranscri(?:pt|bed|ption)\s+by\b/i,
  /\bcaption(?:s|ing|ed)?\s+(?:by|made possible by|sponsored by|provided by)\b/i,
  /advertise your product|become (?:a )?vip member|support us and become/i,
  /^\s*-=.*=-\s*$/,
];
export const R05_ADS_WEAK = /https?:\/\/|www\.|\.(?:com|org|net|tv|io)\b/i;

export const R06_BRACKETS = /\[[^\]]*\]/g;
export const R07_PARENS = /\([^)]*\)/g;
export const R09_ASTERISKS = /\*[^*]{1,40}\*/g;

export const R08_BRACKET_SPEAKER = /^\[([A-Z][A-Za-z .'-]{0,24})\]\s+(?=\S)/;
export const R11_CAPS_SPEAKER = /^([A-Z](?:[A-Z0-9 .'&-]{0,28}[A-Z0-9])?):\s+(?=\S)/;
export const R12_MIXED_SPEAKER = /^([A-Z][a-z]+(?: [A-Z][a-z]+)?):\s+(?=\S)/;
export const SPEAKER_STOPLIST = new Set(['OK', 'NO', 'YES', 'HEY', 'WAIT', 'WHAT', 'OH', 'WOW', 'NOTE', 'PS']);

export const R10_SUNG = /[♪♫]|^\s*#.*#\s*$|^\s*#\s/;
export const R13_DASH = /^\s*[-–—]\s+/;

export const R14_CAPS_ONLY = /^[A-Z]+(?: [A-Z]+){0,2}$/;
export const SOUND_LEXICON = new Set([
  'LAUGHS', 'LAUGHING', 'LAUGHTER', 'SIGHS', 'GASPS', 'GROANS', 'SCREAMS', 'SCREAMING', 'CHEERING',
  'APPLAUSE', 'MUSIC', 'PLAYING', 'SNORES', 'COUGHS', 'CRYING', 'SOBS', 'WHISPERS', 'SHOUTS',
  'KNOCKING', 'RINGING', 'RINGS', 'BEEPS', 'SLAMS', 'THUD', 'SIREN', 'BARKS',
]);

export const R15_INJECTION = [
  /\bignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|messages?)\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+(?:an?|the)\s+(?:ai|assistant|language\s+model|llm|chatbot)\b/i,
  /<\/?\s*(?:system|instructions?|transcript|segment|lines|context)\s*>/i,
];

export const R17_SIGNATURE = /\bl'(?:m|ll|ve|d)\b|(?:^|\s)l(?=\s[a-z])/g;

export const TERMINAL_PUNCT = /[.?!…]["'”’)\]]*$/;
export const HAS_LETTER = /[A-Za-z]/;

// docs/07 §7.16
export const CONTEXT_TAIL_LINES = 15;
export const QA_MIN_LINES = 80;
export const QA_MIN_LINES_PER_MIN = 3;
