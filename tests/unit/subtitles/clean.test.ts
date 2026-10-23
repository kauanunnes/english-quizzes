import { describe, it, expect } from 'vitest';
import { cleanCues } from '@server/domain/subtitles/clean';
import type { Cue, Turn } from '@server/domain/subtitles/types';

const OPTIONS = { dropSungLines: true };

function cue(lines: string[], startMs = 1000): Cue {
  return { idx: 1, startMs, endMs: startMs + 2000, lines };
}

// Limpa um cue isolado e devolve os turnos que sobraram
function turnsOf(lines: string[], options = OPTIONS): Turn[] {
  const { cues } = cleanCues([cue(lines)], options);
  return cues.flatMap((c) => c.turns);
}

const textOf = (lines: string[], options = OPTIONS) => turnsOf(lines, options).map((t) => t.text);

describe('Limpeza do texto (§7.7)', () => {
  it('CLN-01: remove <i> mantendo o texto (R01)', () => {
    expect(textOf(['<i>Hello</i>'])).toEqual(['Hello']);
  });

  it('CLN-02: remove <font color> (R01)', () => {
    expect(textOf(['<font color="#ffff00">Hey</font>'])).toEqual(['Hey']);
  });

  it('CLN-03: remove blocos {…} do ASS (R02)', () => {
    expect(textOf(['{\\an8}Up here'])).toEqual(['Up here']);
  });

  it('CLN-04: decodifica entidades (R03)', () => {
    expect(textOf(['Tom &amp; Jerry'])).toEqual(['Tom & Jerry']);
  });

  it('CLN-05: remove descrição entre colchetes (R06)', () => {
    expect(textOf(["[laughs] That's funny."])).toEqual(["That's funny."]);
  });

  it('CLN-06: remove descrição entre parênteses (R07)', () => {
    expect(textOf(['(sighs) Fine.'])).toEqual(['Fine.']);
  });

  it('CLN-07: cue só com descrição sonora é descartado (R06 + R19)', () => {
    expect(textOf(['[DOOR SLAMS]'])).toEqual([]);
  });

  it('CLN-09: linha cantada é descartada; com DROP_SUNG_LINES=false só os símbolos saem (R10)', () => {
    expect(textOf(['♪ Shine, shine tonight ♪'])).toEqual([]);
    expect(textOf(['♪ Shine, shine tonight ♪'], { dropSungLines: false })).toEqual(['Shine, shine tonight']);
  });

  it('CLN-10: linha entre # é cantada (R10)', () => {
    expect(textOf(['# We can fly #'])).toEqual([]);
  });

  it('CLN-11: propaganda forte some em qualquer posição (R04)', () => {
    const { cues, dropped } = cleanCues([cue(['Synced and corrected by someone'], 21 * 60_000)], OPTIONS);
    expect(cues).toEqual([]);
    expect(dropped.R04).toBe(1);
  });

  it('CLN-14: linha sem letras é descartada (R19)', () => {
    expect(textOf(['...'])).toEqual([]);
    expect(textOf(['-'])).toEqual([]);
  });

  it('CLN-15: colapsa espaços e tira espaço antes da pontuação (R18)', () => {
    expect(textOf(['Hey  ,   you'])).toEqual(['Hey, you']);
  });

  // A entrada do doc (`5 < 6 > 4`) não tem letras e seria descartada pela R19; com uma letra, testa só o escape
  it('CLN-17: < e > viram ‹ e › para não abrir tags do prompt (R16)', () => {
    expect(textOf(['Is 5 < 6 > 4?'])).toEqual(['Is 5 ‹ 6 › 4?']);
  });

  it('CLN-23: descrição quebrada em duas linhas do mesmo cue é removida', () => {
    expect(textOf(['[door', "slams] Who's there?"])).toEqual(["Who's there?"]);
  });

  it('CLN-24: reticências de um caractere viram três pontos (R18)', () => {
    expect(textOf(['It… was me…'])).toEqual(['It... was me...']);
  });
});

describe('Turnos e falantes', () => {
  it('SPK-01: rótulo em caixa alta vira falante (R11)', () => {
    expect(turnsOf(['MAYA: Hey!'])).toEqual([{ speaker: 'MAYA', text: 'Hey!' }]);
  });

  it('SPK-04: horário não é rótulo de falante', () => {
    expect(turnsOf(['10:30 works for me.'])).toEqual([{ speaker: null, text: '10:30 works for me.' }]);
  });

  it('SPK-05: travessão abre um turno novo (R13)', () => {
    expect(turnsOf(['- Are you coming?', '- No.'])).toEqual([
      { speaker: null, text: 'Are you coming?' },
      { speaker: null, text: 'No.' },
    ]);
  });

  it('SPK-08: palavra da stoplist não vira falante', () => {
    expect(turnsOf(["OK: let's go."])).toEqual([{ speaker: null, text: "OK: let's go." }]);
  });

  it('SPK-09: dois turnos com falantes diferentes no mesmo cue', () => {
    expect(turnsOf(['- MAYA: Wait!', '- LEO: What?'])).toEqual([
      { speaker: 'MAYA', text: 'Wait!' },
      { speaker: 'LEO', text: 'What?' },
    ]);
  });

  it('MRG-10: linhas sem travessão no mesmo cue formam um turno só (M01)', () => {
    expect(textOf(["I can't", 'believe it.'])).toEqual(["I can't believe it."]);
  });
});
