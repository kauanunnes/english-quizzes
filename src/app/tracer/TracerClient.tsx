'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useAppStore } from '@shared/store/useAppStore';
import {
  stageMessage,
  type GenerateQuizAccepted,
  type GenerateQuizReady,
  type JobStatus,
  type QuizResponse,
} from '@shared/types/generation';
import type { Problem } from '@shared/types/errors';

type Phase = 'idle' | 'requesting' | 'polling' | 'loading' | 'ready' | 'failed';

const pad2 = (n: number) => String(n).padStart(2, '0');

function approxTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `≈${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

async function problemTitle(res: Response): Promise<string> {
  try {
    return ((await res.json()) as Partial<Problem>).title ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// docs/10 F1: botão Gerar, progresso por polling (pollAfterMs) e lista de perguntas com "mostrar resposta"
export function TracerClient({
  seriesId,
  seasonNumber,
  episodeNumber,
  tracerOnly,
}: {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  tracerOnly: boolean;
}) {
  const storedCode = useAppStore((s) => s.accessCode);
  // Campo não controlado: o que foi digitado antes da hidratação não é apagado (celular lento)
  const codeInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [job, setJob] = useState<JobStatus | null>(null);
  const [pollAfter, setPollAfter] = useState<{ jobId: string; ms: number; tick: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QuizResponse | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const episodeKey = `tmdb-${seriesId}-s${pad2(seasonNumber)}-e${pad2(episodeNumber)}`;
  const apiBase = `/api/episodes/${seriesId}/${seasonNumber}/${episodeNumber}/quiz`;

  const loadQuiz = async (cached: boolean, since: number) => {
    setPhase('loading');
    const res = await fetch(apiBase);
    if (!res.ok) {
      setError(await problemTitle(res));
      setPhase('failed');
      return;
    }
    setData((await res.json()) as QuizResponse);
    setFromCache(cached);
    setElapsedMs(Date.now() - since);
    setPhase('ready');
  };

  const generate = async () => {
    const since = Date.now();
    setStartedAt(since);
    setError(null);
    setJob(null);
    setElapsedMs(null);
    setPhase('requesting');

    const code = codeInput.current?.value.trim() || storedCode;
    const res = await fetch(apiBase, { method: 'POST', headers: code ? { 'X-Access-Code': code } : {} });
    if (!res.ok) {
      setError(await problemTitle(res));
      setPhase('failed');
      return;
    }
    const body = (await res.json()) as GenerateQuizAccepted | GenerateQuizReady;
    if (body.status === 'ready') {
      await loadQuiz(true, since);
      return;
    }
    setPhase('polling');
    setPollAfter({ jobId: body.jobId, ms: body.pollAfterMs, tick: 0 });
  };

  // Uma consulta por vez, no intervalo que o servidor pede
  useEffect(() => {
    if (!pollAfter) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/${pollAfter.jobId}`);
        if (!res.ok) {
          setError(await problemTitle(res));
          setPhase('failed');
          setPollAfter(null);
          return;
        }
        const status = (await res.json()) as JobStatus;
        setJob(status);
        if (status.status === 'ready') {
          setPollAfter(null);
          await loadQuiz(false, startedAt);
        } else if (status.status === 'failed') {
          setPollAfter(null);
          setError(status.error?.message ?? 'Falha na geração.');
          setPhase('failed');
        } else {
          setPollAfter({ jobId: pollAfter.jobId, ms: status.pollAfterMs ?? 4000, tick: pollAfter.tick + 1 });
        }
      } catch {
        setPollAfter({ ...pollAfter, tick: pollAfter.tick + 1 });
      }
    }, pollAfter.ms);
    return () => clearTimeout(timer);
    // loadQuiz e startedAt não mudam durante o polling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollAfter]);

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const busy = phase === 'requesting' || phase === 'polling' || phase === 'loading';
  const quiz = data?.quiz;
  const byId = new Map(quiz?.questions.map((q) => [q.id, q]) ?? []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Tracer · Fase 1</span>
        <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Quiz ponta a ponta de um episódio fixo</h1>
        <p className="text-xs text-zinc-400">
          <span className="font-mono">{episodeKey}</span>
          {tracerOnly ? ' · TRACER_ONLY ligado' : ''}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="tracer-code" className="text-xs font-medium text-zinc-400">
            Código de acesso
          </label>
          <input
            id="tracer-code"
            type="password"
            autoComplete="off"
            ref={codeInput}
            placeholder={storedCode ? 'Usando o código salvo neste aparelho' : 'Digite o código'}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Gerar quiz</span>
          </button>
          {phase === 'ready' && (
            <button
              type="button"
              onClick={generate}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Abrir de novo</span>
            </button>
          )}
        </div>

        {busy && (
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-zinc-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                {job ? stageMessage(job.stage, job.segments) : phase === 'loading' ? 'Abrindo o quiz…' : 'Enviando pedido…'}
              </span>
              <span className="font-bold text-zinc-400">{job?.progress ?? 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${job?.progress ?? 0}%` }} />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-xs text-red-300">
            {error}
          </p>
        )}

        {phase === 'ready' && quiz && (
          <p className="text-xs text-emerald-400" aria-live="polite">
            {quiz.segments.length} blocos · {quiz.questions.length} perguntas · {fromCache ? 'do cache' : 'gerado agora'} em{' '}
            {((elapsedMs ?? 0) / 1000).toFixed(1)} s · versão {data?.version} · {quiz.generation.model}
          </p>
        )}
      </div>

      {quiz &&
        quiz.segments.map((segment) => (
          <section key={segment.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
            <h2 className="text-xs font-bold text-zinc-200">
              Bloco {segment.index} · {segment.label}
              <span className="ml-2 font-normal text-zinc-500">{segment.questionIds.length} perguntas</span>
            </h2>
            {segment.questionIds.length === 0 && <p className="text-xs italic text-zinc-500">Sem perguntas neste bloco.</p>}
            {segment.questionIds.map((id) => {
              const q = byId.get(id);
              if (!q) return null;
              const isRevealed = revealed.has(id);
              const answer = q.options.find((o) => o.id === q.answerId);
              return (
                <article key={id} className="space-y-2 border-t border-zinc-800/60 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex gap-2 text-[10px] font-bold">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{q.id}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{q.level}</span>
                    <span className="rounded bg-indigo-950 px-1.5 py-0.5 uppercase text-indigo-400">{q.type.replace('_', ' ')}</span>
                  </div>
                  <p lang="en" className="text-sm font-semibold text-zinc-100">
                    {q.prompt}
                  </p>
                  <ol lang="en" className="space-y-1 text-xs text-zinc-300">
                    {q.options.map((o) => (
                      <li key={o.id}>
                        <span className="font-mono text-zinc-500">{o.id})</span> {o.text}
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-expanded={isRevealed}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    <Play className="h-3 w-3" />
                    {isRevealed ? 'Esconder resposta' : 'Mostrar resposta'}
                  </button>
                  {isRevealed && (
                    <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs">
                      <p className="font-semibold text-emerald-400">
                        Resposta: {q.answerId}) <span lang="en">{answer?.text}</span>
                      </p>
                      <p lang="en" className="text-zinc-300">
                        {q.explanationEn}
                      </p>
                      {q.explanationPt && <p className="text-zinc-400">{q.explanationPt}</p>}
                      <p className="text-zinc-500">
                        <span className="font-mono text-indigo-400">{approxTime(q.evidence.startMs)}</span>{' '}
                        <span lang="en" className="italic">
                          &ldquo;{q.evidence.quote}&rdquo;
                        </span>
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}
    </div>
  );
}
