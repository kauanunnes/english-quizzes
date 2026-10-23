import type { Transcript } from './types';

// docs/07 §7.3 — D01 a D04
export function decodeBytes(b: Uint8Array): { text: string; encoding: Transcript['encoding'] } {
  // D01: BOM
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(b.subarray(3)), encoding: 'utf-8' };
  if (b[0] === 0xff && b[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(b.subarray(2)), encoding: 'utf-16le' };
  if (b[0] === 0xfe && b[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(b.subarray(2)), encoding: 'utf-16be' };
  // D02: UTF-16 sem BOM
  const { odd, even } = nulRatios(b.subarray(0, 4096));
  if (odd >= 0.2) return { text: new TextDecoder('utf-16le').decode(b), encoding: 'utf-16le' };
  if (even >= 0.2) return { text: new TextDecoder('utf-16be').decode(b), encoding: 'utf-16be' };
  // D03 → D04
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(b), encoding: 'utf-8' };
  } catch {
    return { text: decodeWindows1252(b), encoding: 'windows-1252' };
  }
}

// D04 com tabela manual: no Node 24, TextDecoder('windows-1252') se comporta como latin1 e deixa
// 0x80–0x9F como caracteres de controle (ENC-05, confirmado em 23/10/2026). Os 5 bytes indefinidos
// ficam como U+0081… (mesmo comportamento do WHATWG) e contam no controlCharRatio (D07).
const WINDOWS_1252_C1: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d,
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

function decodeWindows1252(b: Uint8Array): string {
  const chars = new Array<string>(b.length);
  for (let i = 0; i < b.length; i++) {
    chars[i] = String.fromCharCode(WINDOWS_1252_C1[b[i]] ?? b[i]);
  }
  return chars.join('');
}

// Proporção de bytes nulos nas posições ímpares e pares
function nulRatios(b: Uint8Array): { odd: number; even: number } {
  let oddNul = 0;
  let evenNul = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== 0) continue;
    if (i % 2 === 1) oddNul++;
    else evenNul++;
  }
  const oddPositions = Math.floor(b.length / 2);
  const evenPositions = Math.ceil(b.length / 2);
  return {
    odd: oddPositions ? oddNul / oddPositions : 0,
    even: evenPositions ? evenNul / evenPositions : 0,
  };
}

// D06: quebras de linha, NFC, espaços especiais
export function normalizeText(text: string): string {
  return text
    .replace(/﻿/g, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    .replace(/ /g, ' ')
    .replace(/[​-‍⁠‎‏]/g, '');
}

// D07: caracteres de controle (C0 exceto \n e \t, C1 e U+FFFD) ÷ total, para o gate Q07
export function controlCharRatio(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code < 0x20 && ch !== '\n' && ch !== '\t') || (code >= 0x80 && code <= 0x9f) || code === 0xfffd) count++;
  }
  return count / text.length;
}
