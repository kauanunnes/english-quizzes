// Contratos do pipeline de legendas que também são gravados no banco (docs/05 §5.3, docs/07 §7.1)
// Nenhum destes tipos carrega texto de legenda (ADR-009).

export type RuleId = string; // 'R04', 'R10', 'M02'…

export type ParserStats = {
  bytes: number;
  cuesIn: number;
  cuesOut: number;
  linesOut: number;
  wordsOut: number;
  durationMs: number;
  controlCharRatio: number;
  fixedTiming: number;
  dropped: Partial<Record<RuleId, number>>; // contagem por regra
};

export type QaGate = 'Q01' | 'Q02' | 'Q03' | 'Q04' | 'Q05' | 'Q06' | 'Q07';

export type QaGateResult = { passed: boolean; value: number; threshold: number };

export type QaResult = {
  passed: boolean;
  failedGate: QaGate | null;
  gates: Partial<Record<QaGate, QaGateResult>>;
};

// Top 5 candidatos guardados em subtitle_selections.candidates (só metadados, §4.2.7)
export type CandidateSummary = {
  subtitleId: string;
  fileId: number | null;
  release: string | null;
  language: string;
  hearingImpaired: boolean;
  fromTrusted: boolean;
  downloadCount: number;
  uploadDate: string | null;
  score: number;
};
