import { LlmQuestionSchema, type LlmQuestion } from '@shared/types/llmSegmentOutput';
import type { Line, Segment } from '../subtitles/types';

// docs/08 §8.7 — Fase 1: schema, ANSWER_INVALID (coerência mínima) e EVIDENCE_LINES_INVALID.
// As demais regras (EVIDENCE_NOT_FOUND, VISUAL_QUESTION, UNKNOWN_NAME…) e o reparo entram na Fase 4.

export type ValidationCode = 'SCHEMA_INVALID' | 'ANSWER_INVALID' | 'EVIDENCE_LINES_INVALID';

export type SegmentValidation = {
  segmentId: string;
  generated: number;
  skipped: number;
  valid: LlmQuestion[];
  problems: { slot: string; code: ValidationCode }[];
};

const EVIDENCE_MAX_LINES = 4;
const EVIDENCE_WINDOW_LINES = 6;

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

// Enums comparados sem diferenciar maiúsculas (§8.7)
function normalizeEnums(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const q: Loose = { ...raw };
  if (typeof q.level === 'string') q.level = q.level.trim().toUpperCase();
  if (typeof q.type === 'string') q.type = q.type.trim().toLowerCase();
  if (typeof q.answer === 'string') q.answer = q.answer.trim().toLowerCase();
  if (Array.isArray(q.options)) {
    q.options = q.options.map((o) => (isObject(o) && typeof o.id === 'string' ? { ...o, id: o.id.trim().toLowerCase() } : o));
  }
  if (isObject(q.focus) && typeof q.focus.kind === 'string') q.focus = { ...q.focus, kind: q.focus.kind.trim().toLowerCase() };
  return q;
}

export function validateSegment(output: unknown, segment: Segment, lines: Line[]): SegmentValidation {
  const position = new Map(lines.map((l, i) => [l.id, i]));
  const inBlock = new Set(segment.lineIds);
  const rawQuestions = isObject(output) && Array.isArray(output.questions) ? output.questions : [];
  const skipped = isObject(output) && Array.isArray(output.skipped) ? output.skipped.length : 0;

  const result: SegmentValidation = { segmentId: segment.id, generated: rawQuestions.length, skipped, valid: [], problems: [] };

  for (const raw of rawQuestions) {
    const slot = isObject(raw) && typeof raw.slot === 'string' ? raw.slot : '?';
    const parsed = LlmQuestionSchema.safeParse(normalizeEnums(raw));
    if (!parsed.success) {
      result.problems.push({ slot, code: 'SCHEMA_INVALID' });
      continue;
    }
    const q = parsed.data;

    if (!q.options.some((o) => o.id === q.answer)) {
      result.problems.push({ slot, code: 'ANSWER_INVALID' });
      continue;
    }

    // 1–4 IDs, todos em <lines> do bloco (o contexto não vale) e dentro de uma janela de 6 linhas
    const ids = q.evidence.line_ids;
    const positions = ids.map((id) => position.get(id));
    const allInBlock = ids.every((id) => inBlock.has(id)) && positions.every((p) => p !== undefined);
    const span = allInBlock ? Math.max(...(positions as number[])) - Math.min(...(positions as number[])) : Infinity;
    if (ids.length < 1 || ids.length > EVIDENCE_MAX_LINES || !allInBlock || span >= EVIDENCE_WINDOW_LINES) {
      result.problems.push({ slot, code: 'EVIDENCE_LINES_INVALID' });
      continue;
    }

    result.valid.push(q);
  }

  return result;
}
