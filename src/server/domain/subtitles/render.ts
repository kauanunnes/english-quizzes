import { CONTEXT_TAIL_LINES } from './rules';
import type { Line, Segment } from './types';

// docs/07 §7.12 — contrato com o item 8
export function renderLine(line: Line): string {
  return `${line.id}${line.speaker ? ` [${line.speaker}]` : ''}: ${line.text}`;
}

// O bloco-alvo com as últimas linhas do anterior como contexto; nunca linhas posteriores (anti-spoiler)
export function renderSegment(lines: Line[], segments: Segment[], segmentId: string, contextTail = CONTEXT_TAIL_LINES): string {
  const index = segments.findIndex((s) => s.id === segmentId);
  if (index < 0) throw new Error(`segment ${segmentId} not found`);

  const byId = new Map(lines.map((l) => [l.id, l]));
  const render = (ids: string[]) => ids.map((id) => byId.get(id)).filter((l): l is Line => l !== undefined).map(renderLine);

  const parts = [`<segment id="${segmentId}">`];
  if (index > 0) {
    parts.push('<context>', ...render(segments[index - 1].lineIds.slice(-contextTail)), '</context>');
  }
  parts.push('<lines>', ...render(segments[index].lineIds), '</lines>', '</segment>');
  return parts.join('\n');
}
