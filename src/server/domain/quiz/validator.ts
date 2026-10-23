import { z } from 'zod';
import { CefrLevelSchema, Question, QuestionTypeSchema } from '@shared/types/quiz';
import { SubtitleSegment, SubtitleLine } from '../subtitles/types';
import { formatSecondsToTime } from '../subtitles/parser';

const MAX_EVIDENCE_WORDS = 15; // ADR-008, item 7

// A saída estruturada garante o formato, mas o enum pode vir com outra capitalização (§4.3.2)
const RawQuestionSchema = z.object({
  id: z.string().min(1),
  level: z.string().transform((v) => v.trim().toUpperCase()).pipe(CefrLevelSchema),
  type: z.string().transform((v) => v.trim().toLowerCase()).pipe(QuestionTypeSchema),
  prompt: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int(),
  evidence: z.object({
    lineIds: z.array(z.string()).min(1),
    text: z.string().min(1),
  }),
  explanation: z.string().optional(),
  explanationPt: z.string().optional(),
});

export interface ValidationResult {
  validQuestions: Question[];
  rejectedQuestions: { question: unknown; reason: string }[];
}

function normalizeSnippet(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateAndEnrichSegmentQuestions(
  rawQuestions: unknown[],
  segment: SubtitleSegment
): ValidationResult {
  const lineMap = new Map<string, SubtitleLine>();
  for (const l of segment.lines) {
    lineMap.set(l.id, l);
  }

  const validQuestions: Question[] = [];
  const rejectedQuestions: { question: unknown; reason: string }[] = [];

  for (const raw of rawQuestions) {
    const parsed = RawQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      rejectedQuestions.push({
        question: raw,
        reason: `Invalid question shape at "${issue?.path.join('.') ?? ''}": ${issue?.message ?? 'unknown'}`,
      });
      continue;
    }
    const q = parsed.data;

    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      rejectedQuestions.push({ question: raw, reason: 'Invalid correctIndex bounds' });
      continue;
    }

    // Long quotes are cut down to the leading words; a prefix of a real quote still matches below
    const words = q.evidence.text.trim().split(/\s+/);
    if (words.length > MAX_EVIDENCE_WORDS) {
      q.evidence.text = words.slice(0, MAX_EVIDENCE_WORDS).join(' ');
    }

    // Verify all lineIds exist in this segment
    let firstLineTime = segment.startSeconds;
    let foundFirstLine = false;
    let allLinesValid = true;
    let combinedDialogue = '';

    for (const lineId of q.evidence.lineIds) {
      const line = lineMap.get(lineId);
      if (!line) {
        allLinesValid = false;
        break;
      }
      if (!foundFirstLine) {
        firstLineTime = line.startSeconds;
        foundFirstLine = true;
      }
      combinedDialogue += ' ' + line.text;
    }

    if (!allLinesValid) {
      rejectedQuestions.push({
        question: raw,
        reason: `Evidence lineIds [${q.evidence.lineIds.join(', ')}] not found in target segment ${segment.id}`,
      });
      continue;
    }

    // Verify quotation actually exists in the cited lines
    const normQuotation = normalizeSnippet(q.evidence.text);
    const normDialogue = normalizeSnippet(combinedDialogue);

    if (normQuotation.length > 3 && !normDialogue.includes(normQuotation)) {
      // If slight mismatch, check token overlap
      const quoteTokens = normQuotation.split(' ');
      const matchTokens = quoteTokens.filter((t) => normDialogue.includes(t));
      if (matchTokens.length / quoteTokens.length < 0.6) {
        rejectedQuestions.push({
          question: raw,
          reason: `Quotation "${q.evidence.text}" not found in cited lines`,
        });
        continue;
      }
    }

    const approxTimeSeconds = Math.round(firstLineTime);
    const formattedTime = `≈${formatSecondsToTime(approxTimeSeconds)}`;

    validQuestions.push({
      id: q.id,
      segmentId: segment.id,
      level: q.level,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      evidence: {
        lineIds: q.evidence.lineIds,
        text: q.evidence.text,
        approxTimeSeconds,
        formattedTime,
      },
      explanation: q.explanation || 'Based on the dialogue.',
      explanationPt: q.explanationPt || 'Com base no diálogo.',
    });
  }

  // Sort questions chronologically by the timestamp of their evidence
  validQuestions.sort((a, b) => a.evidence.approxTimeSeconds - b.evidence.approxTimeSeconds);

  return { validQuestions, rejectedQuestions };
}
