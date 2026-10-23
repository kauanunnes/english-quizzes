// server/integrations/opensubtitles/selection.ts
import { OsSubtitleAttributes } from './types';

export function scoreCandidate(a: OsSubtitleAttributes, now = Date.now()): number {
  let s = 0;
  if (a.from_trusted) s += 40; // fonte confiável
  if (!a.hearing_impaired) s += 20; // preferir sem HI (decisão A2)
  s += Math.min(30, 10 * Math.log10(1 + (a.download_count ?? 0))); // popularidade, com teto
  if ((a.votes ?? 0) >= 3) s += 2 * (a.ratings ?? 0); // nota 0–10, só com votos
  if (/\b(web[-. ]?(dl|rip)|amzn|nf|dsnp|hmax|atvp|pcok)\b/i.test(a.release ?? '')) s += 5; // origem streaming
  const ageYears = (now - Date.parse(a.upload_date)) / (365.25 * 24 * 3600 * 1000);
  if (Number.isFinite(ageYears) && ageYears < 3) s += 5 * (1 - ageYears / 3); // revisões recentes
  return Math.round(s * 10) / 10;
}

// Filtros obrigatórios de §4.2.6; a validação V1/V2 de título e IDs fica com quem chama
export function filterCandidate(a: OsSubtitleAttributes): boolean {
  // 1. Language
  if (a.language !== 'en') return false;

  // 2. No AI or Machine translation
  if (a.ai_translated || a.machine_translated) return false;

  // 3. Not foreign parts only
  if (a.foreign_parts_only) return false;

  // 4. Exactly 1 file (no split CD parts)
  if (!a.files || a.files.length !== 1) return false;

  // 5. Machine translation clues in release/comments
  const textToCheck = `${a.release || ''} ${a.comments || ''}`;
  if (/machine|google translat|auto[- ]?translat|\bai[- ]translat/i.test(textToCheck)) {
    return false;
  }

  return true;
}
