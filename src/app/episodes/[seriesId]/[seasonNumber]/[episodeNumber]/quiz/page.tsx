'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { QuizDocument, Question, CefrLevel } from '@shared/types/quiz';
import { useAppStore } from '@shared/store/useAppStore';
import { useWakeLock } from '@/hooks/useWakeLock';
import {
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  ChevronLeft,
  RotateCcw,
  Languages,
  Award,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';

export default function QuizPlayerPage({
  params,
}: {
  params: Promise<{ seriesId: string; seasonNumber: string; episodeNumber: string }>;
}) {
  const { seriesId, seasonNumber, episodeNumber } = use(params);
  const sId = parseInt(seriesId, 10);
  const sNum = parseInt(seasonNumber, 10);
  const eNum = parseInt(episodeNumber, 10);

  const { level, setLevel, includeNeighborLevels, ptExplanationDefault, keepScreenAwake, saveAttempt } = useAppStore();
  useWakeLock(keepScreenAwake);

  const [quiz, setQuiz] = useState<QuizDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unlocked segments indices (Set of numbers: 1, 2...)
  const [unlockedSegments, setUnlockedSegments] = useState<Set<number>>(new Set([1]));

  // User answers map: { [questionId]: { selectedIndex: number; isCorrect: boolean } }
  const [answers, setAnswers] = useState<Record<string, { selectedIndex: number; isCorrect: boolean }>>({});

  // Language toggle for explanation per question: { [questionId]: 'en' | 'pt' }
  const [explanationLangs, setExplanationLangs] = useState<Record<string, 'en' | 'pt'>>({});

  // Quiz completed flag
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await fetch(`/api/episodes/${sId}/${sNum}/${eNum}/quiz`);
        if (!res.ok) {
          throw new Error('Quiz ainda não foi gerado para este episódio.');
        }
        const data: QuizDocument = await res.json();
        setQuiz(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar o quiz');
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [sId, sNum, eNum]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-zinc-400">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
        <p className="mt-3 text-sm font-medium">Carregando quiz do episódio...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 space-y-3">
          <p className="text-zinc-200 font-semibold">{error || 'Quiz não encontrado'}</p>
          <Link
            href={`/series/${sId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Voltar para lista de episódios</span>
          </Link>
        </div>
      </div>
    );
  }

  // Filter questions by level
  const allowedLevels = new Set<CefrLevel>([level]);
  if (includeNeighborLevels) {
    if (level === 'B1') {
      allowedLevels.add('A2');
      allowedLevels.add('B2');
    } else if (level === 'B2') {
      allowedLevels.add('B1');
      allowedLevels.add('C1');
    } else if (level === 'A2') {
      allowedLevels.add('B1');
    } else if (level === 'C1') {
      allowedLevels.add('B2');
    }
  }

  const handleSelectOption = (q: Question, optionIndex: number) => {
    // If already answered, do not allow changing
    if (answers[q.id]) return;

    const isCorrect = optionIndex === q.correctIndex;
    const newAnswers = {
      ...answers,
      [q.id]: { selectedIndex: optionIndex, isCorrect },
    };
    setAnswers(newAnswers);

    // Check if this was the last question in the quiz
    const allQuestions = quiz.segments.flatMap((s) => s.questions.filter((item) => allowedLevels.has(item.level)));
    const totalCount = allQuestions.length;
    const answeredCount = Object.keys(newAnswers).length;

    if (answeredCount >= totalCount && totalCount > 0) {
      setIsCompleted(true);
      const correctCount = Object.values(newAnswers).filter((a) => a.isCorrect).length;
      saveAttempt({
        episodeKey: quiz.episodeKey,
        seriesId: quiz.seriesId,
        seriesTitle: quiz.seriesTitle,
        seasonNumber: quiz.seasonNumber,
        episodeNumber: quiz.episodeNumber,
        episodeTitle: quiz.episodeTitle,
        level,
        totalQuestions: totalCount,
        correctAnswers: correctCount,
        percentage: Math.round((correctCount / totalCount) * 100),
      });
    }
  };

  const unlockNextSegment = (nextIndex: number) => {
    setUnlockedSegments((prev) => new Set([...prev, nextIndex]));
  };

  const unlockAllSegments = () => {
    const all = new Set(quiz.segments.map((s) => s.index));
    setUnlockedSegments(all);
  };

  const toggleExplanationLang = (questionId: string) => {
    setExplanationLangs((prev) => {
      const current = prev[questionId] || (ptExplanationDefault ? 'pt' : 'en');
      return {
        ...prev,
        [questionId]: current === 'pt' ? 'en' : 'pt',
      };
    });
  };

  // Compute overall score
  const answeredList = Object.values(answers);
  const correctCount = answeredList.filter((a) => a.isCorrect).length;
  const scorePercent = answeredList.length > 0 ? Math.round((correctCount / answeredList.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/series/${sId}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{quiz.seriesTitle}</span>
        </Link>

        {/* Level Selector Pill */}
        <div className="flex items-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1 text-xs">
          {(['A2', 'B1', 'B2', 'C1'] as CefrLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                level === lvl
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Episode Header */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
          S{String(quiz.seasonNumber).padStart(2, '0')}E{String(quiz.episodeNumber).padStart(2, '0')}
        </span>
        <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">{quiz.episodeTitle}</h1>
      </div>

      {/* Score Summary Bar */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-400" />
          <div>
            <span className="text-xs font-semibold text-zinc-200">
              {correctCount} de {answeredList.length} acertadas
            </span>
            <span className="text-xs text-zinc-400 ml-1.5">({scorePercent}%)</span>
          </div>
        </div>

        {!unlockedSegments.has(quiz.segments.length) && (
          <button
            onClick={unlockAllSegments}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 underline"
          >
            Liberar tudo (já assisti)
          </button>
        )}
      </div>

      {/* Segments Loop */}
      <div className="space-y-6">
        {quiz.segments.map((segment) => {
          const isUnlocked = unlockedSegments.has(segment.index);
          const filteredQuestions = segment.questions.filter((q) => allowedLevels.has(q.level));

          return (
            <div
              key={segment.id}
              className={`overflow-hidden rounded-2xl border transition-all ${
                isUnlocked
                  ? 'border-zinc-800 bg-zinc-900/40 shadow-sm'
                  : 'border-zinc-800/50 bg-zinc-950/40 opacity-75'
              }`}
            >
              {/* Segment Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-200">{segment.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      <Unlock className="h-3 w-3" />
                      Liberado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                      <Lock className="h-3 w-3" />
                      Bloqueado
                    </span>
                  )}
                </div>
              </div>

              {/* Segment Content */}
              {isUnlocked ? (
                <div className="p-4 space-y-6">
                  {filteredQuestions.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">
                      Nenhuma pergunta cadastrada para o nível {level} neste trecho. Alterne o nível acima ou ative níveis vizinhos nas configurações.
                    </p>
                  ) : (
                    filteredQuestions.map((q, qIndex) => {
                      const answer = answers[q.id];
                      const isAnswered = !!answer;
                      const activeLang = explanationLangs[q.id] || (ptExplanationDefault ? 'pt' : 'en');

                      return (
                        <div
                          key={q.id}
                          className="space-y-3 border-b border-zinc-800/50 pb-5 last:border-b-0 last:pb-0"
                        >
                          {/* Question Badges */}
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="rounded bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-2 py-0.5 uppercase tracking-wider">
                              {q.type.replace('_', ' ')}
                            </span>
                            <span className="rounded bg-zinc-800 text-zinc-300 px-2 py-0.5">
                              {q.level}
                            </span>
                          </div>

                          {/* Question Prompt */}
                          <p className="text-sm font-semibold text-zinc-100 leading-snug">
                            {qIndex + 1}. <span lang="en">{q.prompt}</span>
                          </p>

                          {/* Options List */}
                          <div className="space-y-2" lang="en">
                            {q.options.map((option, optIdx) => {
                              const isSelected = answer?.selectedIndex === optIdx;
                              const isCorrectOption = optIdx === q.correctIndex;

                              let btnClasses =
                                'w-full text-left rounded-xl border p-3 text-xs transition-all flex items-start justify-between gap-3 ';

                              if (!isAnswered) {
                                btnClasses +=
                                  'border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-indigo-500 hover:bg-zinc-800/80 active:scale-[0.99]';
                              } else {
                                if (isCorrectOption) {
                                  btnClasses +=
                                    'border-emerald-600 bg-emerald-950/40 text-emerald-200 font-semibold';
                                } else if (isSelected && !answer.isCorrect) {
                                  btnClasses +=
                                    'border-red-600 bg-red-950/40 text-red-200 line-through';
                                } else {
                                  btnClasses += 'border-zinc-800/50 bg-zinc-950/40 text-zinc-500 opacity-60';
                                }
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleSelectOption(q, optIdx)}
                                  disabled={isAnswered}
                                  className={btnClasses}
                                >
                                  <span>{option}</span>
                                  {isAnswered && isCorrectOption && (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                                  )}
                                  {isAnswered && isSelected && !answer.isCorrect && (
                                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Explanation and Evidence (Revealed only after answering) */}
                          {isAnswered && (
                            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2.5 animate-fadeIn">
                              {/* Feedback header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                  {answer.isCorrect ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                      <span className="text-emerald-400">Resposta Correta!</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 text-red-400" />
                                      <span className="text-red-400">Incorreto</span>
                                    </>
                                  )}
                                </div>

                                <button
                                  onClick={() => toggleExplanationLang(q.id)}
                                  className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:text-zinc-50"
                                >
                                  <Languages className="h-3 w-3" />
                                  <span>{activeLang === 'pt' ? 'Ver em inglês' : 'Ver em português'}</span>
                                </button>
                              </div>

                              {/* Explanation text */}
                              <p
                                lang={activeLang === 'pt' && q.explanationPt ? 'pt-BR' : 'en'}
                                className="text-xs text-zinc-300 leading-relaxed"
                              >
                                {activeLang === 'pt' && q.explanationPt ? q.explanationPt : q.explanation}
                              </p>

                              {/* Evidence line & quote */}
                              <div className="rounded-lg bg-zinc-900/90 border border-zinc-800/80 px-2.5 py-1.5 text-[11px] text-zinc-400 flex items-center justify-between">
                                <span className="font-mono text-indigo-400">
                                  {q.evidence.formattedTime}
                                </span>
                                <span lang="en" className="italic line-clamp-1 max-w-[280px]">
                                  &ldquo;{q.evidence.text}&rdquo;
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Button to unlock next block */}
                  {segment.index < quiz.segments.length && !unlockedSegments.has(segment.index + 1) && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => unlockNextSegment(segment.index + 1)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
                      >
                        <Unlock className="h-4 w-4" />
                        <span>Já assisti até {segment.formattedEnd} · Liberar próximo bloco</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center space-y-3">
                  <Lock className="mx-auto h-6 w-6 text-zinc-600" />
                  <p className="text-xs font-medium text-zinc-400">
                    Este bloco está bloqueado para evitar spoilers enquanto você assiste.
                  </p>
                  <button
                    onClick={() => unlockNextSegment(segment.index)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    <span>Já assisti até aqui · Liberar</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion Modal / Banner */}
      {isCompleted && (
        <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/30 p-6 text-center space-y-3 backdrop-blur-sm">
          <Sparkles className="mx-auto h-8 w-8 text-emerald-400" />
          <h2 className="text-lg font-bold text-zinc-100">Parabéns! Quiz concluído!</h2>
          <p className="text-xs text-zinc-300">
            Você acertou {correctCount} de {answeredList.length} perguntas ({scorePercent}% de aproveitamento) no nível {level}.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setAnswers({});
                setIsCompleted(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Refazer Quiz</span>
            </button>
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <span>Ver Histórico</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
