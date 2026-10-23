import { describe, it, expect } from 'vitest';
import { decodeBytes, normalizeText } from '@server/domain/subtitles/decode';
import { utf8 } from './helpers';

const MINIMAL_SRT = '1\n00:00:01,000 --> 00:00:02,000\nHi\n';

describe('Decodificação (§7.3)', () => {
  it('ENC-01: UTF-8 com BOM é detectado e o BOM some do texto', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(MINIMAL_SRT)]);
    const { text, encoding } = decodeBytes(bytes);
    expect(encoding).toBe('utf-8');
    expect(text).toBe(MINIMAL_SRT);
    expect(text).not.toContain('﻿');
  });

  it('ENC-02: UTF-16LE com BOM produz o mesmo texto', () => {
    const body = Buffer.from(MINIMAL_SRT, 'utf16le');
    const { text, encoding } = decodeBytes(new Uint8Array([0xff, 0xfe, ...body]));
    expect(encoding).toBe('utf-16le');
    expect(text).toBe(MINIMAL_SRT);
  });

  it('ENC-04: UTF-16LE sem BOM é detectado pelos bytes nulos (D02)', () => {
    const { text, encoding } = decodeBytes(new Uint8Array(Buffer.from(MINIMAL_SRT, 'utf16le')));
    expect(encoding).toBe('utf-16le');
    expect(text).toBe(MINIMAL_SRT);
  });

  it('ENC-05: Windows-1252 quando o UTF-8 estrito falha', () => {
    const bytes = new Uint8Array([...utf8('It'), 0x92, ...utf8('s caf'), 0xe9]);
    const { text, encoding } = decodeBytes(bytes);
    expect(encoding).toBe('windows-1252');
    expect(text).toBe('It’s café');
  });

  it('ENC-09: \\r\\n e \\r misturados viram só \\n (D06)', () => {
    expect(normalizeText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('ENC-10: NBSP vira espaço; U+200B e U+200E somem (D06)', () => {
    expect(normalizeText('a b​c‎d')).toBe('a bcd');
  });

  it('D06: aplica NFC e remove U+FEFF no meio do texto', () => {
    expect(normalizeText('café﻿')).toBe('café');
  });
});
