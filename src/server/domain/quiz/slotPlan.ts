import type { CefrLevel, QuestionType } from '@shared/types/quiz';

// docs/08 §8.2 — 8 slots por bloco (2 por nível); os tipos alternam entre blocos ímpares e pares
export type Slot = { id: string; level: CefrLevel; type: QuestionType };

const ODD: Record<CefrLevel, [QuestionType, QuestionType]> = {
  A2: ['true_false', 'comprehension'],
  B1: ['comprehension', 'vocabulary'],
  B2: ['inference', 'vocabulary'],
  C1: ['inference', 'vocabulary'],
};

const EVEN: Record<CefrLevel, [QuestionType, QuestionType]> = {
  A2: ['comprehension', 'fill_blank'],
  B1: ['true_false', 'vocabulary'],
  B2: ['comprehension', 'inference'],
  C1: ['vocabulary', 'inference'],
};

// Pares (nível, tipo) aceitos quando a IA troca o tipo do slot (TYPE_MISMATCH, Fase 4)
export const ACCEPTED_TYPES: Record<CefrLevel, QuestionType[]> = {
  A2: ['comprehension', 'true_false', 'fill_blank'],
  B1: ['comprehension', 'true_false', 'fill_blank', 'vocabulary'],
  B2: ['comprehension', 'inference', 'vocabulary', 'fill_blank'],
  C1: ['comprehension', 'inference', 'vocabulary'],
};

export function slotPlanFor(segmentId: string, segmentIndex: number): Slot[] {
  const table = segmentIndex % 2 === 1 ? ODD : EVEN;
  return (Object.keys(table) as CefrLevel[]).flatMap((level) =>
    table[level].map((type, i) => ({ id: `${segmentId}-${level}-${i + 1}`, level, type }))
  );
}
