import { describe, it, expect } from 'vitest';
import { validateSegment } from '@server/domain/quiz/validate';
import { exampleOutput, exampleTranscript } from './helpers';

const { lines, segments } = exampleTranscript();
const S2 = segments[1];

function withQuestion(patch: Record<string, unknown>) {
  const output = exampleOutput();
  output.questions = [{ ...output.questions[0], ...patch }];
  return output;
}

describe('Validação da Fase 1 (§8.7)', () => {
  it('as 8 perguntas do exemplo do §8.12 passam', () => {
    const result = validateSegment(exampleOutput(), S2, lines);
    expect(result.problems).toEqual([]);
    expect(result.valid).toHaveLength(8);
    expect(result.generated).toBe(8);
  });

  it('enums com outra capitalização são aceitos', () => {
    const result = validateSegment(withQuestion({ level: 'a2', type: 'Comprehension', answer: 'A' }), S2, lines);
    expect(result.valid[0]).toMatchObject({ level: 'A2', type: 'comprehension', answer: 'a' });
  });

  it('EVIDENCE_LINES_INVALID: linha do contexto não vale como evidência', () => {
    const result = validateSegment(withQuestion({ evidence: { line_ids: ['L042'], quote: "Don't remind me." } }), S2, lines);
    expect(result.problems).toEqual([{ slot: 'S2-A2-1', code: 'EVIDENCE_LINES_INVALID' }]);
  });

  it('EVIDENCE_LINES_INVALID: mais de 4 IDs, fora da janela de 6 linhas, inexistente ou vazio', () => {
    const cases = [
      ['L043', 'L044', 'L045', 'L046', 'L047'],
      ['L043', 'L050'],
      ['L099'],
      [],
    ];
    for (const lineIds of cases) {
      const result = validateSegment(withQuestion({ evidence: { line_ids: lineIds, quote: 'x' } }), S2, lines);
      expect(result.problems.map((p) => p.code)).toEqual(['EVIDENCE_LINES_INVALID']);
    }
  });

  it('EVIDENCE_LINES_INVALID: janela de 6 linhas é aceita no limite', () => {
    const result = validateSegment(withQuestion({ evidence: { line_ids: ['L043', 'L048'], quote: 'x' } }), S2, lines);
    expect(result.valid).toHaveLength(1);
  });

  it('ANSWER_INVALID: resposta fora das alternativas', () => {
    const output = withQuestion({ answer: 'd', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }] });
    expect(validateSegment(output, S2, lines).problems).toEqual([{ slot: 'S2-A2-1', code: 'ANSWER_INVALID' }]);
  });

  it('SCHEMA_INVALID: campo faltando ou nível desconhecido', () => {
    const missing = exampleOutput();
    delete missing.questions[0].prompt;
    expect(validateSegment(missing, S2, lines).problems[0].code).toBe('SCHEMA_INVALID');
    expect(validateSegment(withQuestion({ level: 'C2' }), S2, lines).problems[0].code).toBe('SCHEMA_INVALID');
  });

  it('saída sem lista de perguntas vira bloco vazio, sem exceção', () => {
    expect(validateSegment({ segment_id: 'S2' }, S2, lines)).toMatchObject({ generated: 0, valid: [], problems: [] });
    expect(validateSegment(null, S2, lines).valid).toEqual([]);
  });
});
