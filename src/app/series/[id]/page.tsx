'use client';

import { useState, useEffect, useLayoutEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SeriesDetails,
  SeasonDetails,
  EpisodeSummary,
} from '@shared/types/catalog';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { useAppStore } from '@shared/store/useAppStore';
import { stageMessage, type GenerateQuizAccepted, type GenerateQuizReady, type JobStatus } from '@shared/types/generation';
import type { Problem } from '@shared/types/errors';
import {
  Play,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Calendar,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';

interface GenerationModalState {
  isOpen: boolean;
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  jobId: string | null;
  stage: string;
  percentage: number;
  status: string;
  error?: string | null;
  pollAfterMs?: number; // intervalo pedido pelo servidor (§6.6)
  polls?: number; // cada consulta concluída agenda a próxima
}

// Corpo de erro da API (problem+json, §6.1)
async function problemTitle(res: Response, fallback: string): Promise<string> {
  try {
    const problem = (await res.json()) as Partial<Problem>;
    return problem.title || fallback;
  } catch {
    return fallback;
  }
}

export default function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const seriesId = parseInt(id, 10);

  const { noSpoilerMode, accessCode, setAccessCode } = useAppStore();

  const [series, setSeries] = useState<SeriesDetails | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [seasonData, setSeasonData] = useState<SeasonDetails | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [loadingSeason, setLoadingSeason] = useState(false);

  // Generation Modal & Polling State
  const [genModal, setGenModal] = useState<GenerationModalState>({
    isOpen: false,
    seriesId: 0,
    seasonNumber: 0,
    episodeNumber: 0,
    episodeTitle: '',
    jobId: null,
    stage: '',
    percentage: 0,
    status: 'idle',
  });

  const [codeDraft, setCodeDraft] = useState('');

  // A página fica montada (escondida) ao navegar; um modal de quiz pronto não deve reaparecer na volta
  useLayoutEffect(() => {
    return () => {
      setGenModal((prev) => (prev.status === 'ready' ? { ...prev, isOpen: false } : prev));
    };
  }, []);

  // Load series details
  useEffect(() => {
    async function loadSeries() {
      try {
        const res = await fetch(`/api/series/${seriesId}`);
        if (!res.ok) throw new Error('Falha ao carregar série');
        const data: SeriesDetails = await res.json();
        setSeries(data);

        // Find initial season (season 1 if exists, otherwise first available)
        const s1 = data.seasons.find((s) => s.seasonNumber === 1);
        const initialSeason = s1 ? 1 : data.seasons[0]?.seasonNumber ?? 1;
        setActiveSeason(initialSeason);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSeries(false);
      }
    }
    loadSeries();
  }, [seriesId]);

  // Load active season episodes
  useEffect(() => {
    if (!series) return;
    async function loadSeason() {
      setLoadingSeason(true);
      try {
        const res = await fetch(`/api/series/${seriesId}/season/${activeSeason}`);
        if (!res.ok) throw new Error('Falha ao carregar temporada');
        const data: SeasonDetails = await res.json();
        setSeasonData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSeason(false);
      }
    }
    loadSeason();
  }, [seriesId, activeSeason, series]);

  // Polling do job no intervalo que o servidor pede (pollAfterMs, §6.6); pausa quando a página fica escondida
  useEffect(() => {
    if (!genModal.isOpen || !genModal.jobId || genModal.status === 'ready' || genModal.status === 'failed') {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/${genModal.jobId}`);
        if (!res.ok) {
          const message = await problemTitle(res, 'Não foi possível acompanhar a geração.');
          setGenModal((prev) => ({ ...prev, status: 'failed', error: message }));
          return;
        }
        const job = (await res.json()) as JobStatus;

        setGenModal((prev) => ({
          ...prev,
          stage: stageMessage(job.stage, job.segments),
          percentage: job.progress,
          status: job.status,
          error: job.error?.message ?? null,
          pollAfterMs: job.pollAfterMs ?? prev.pollAfterMs,
          polls: (prev.polls ?? 0) + 1,
        }));

        if (job.status === 'ready') {
          // Redirect to quiz after brief confirmation
          setTimeout(() => {
            router.push(`/episodes/${genModal.seriesId}/${genModal.seasonNumber}/${genModal.episodeNumber}/quiz`);
          }, 1200);
        }
      } catch {
        // Rede instável no celular: tenta de novo no próximo intervalo
        setGenModal((prev) => ({ ...prev, polls: (prev.polls ?? 0) + 1 }));
      }
    }, genModal.pollAfterMs ?? 2000);

    return () => clearTimeout(timer);
  }, [
    genModal.isOpen,
    genModal.jobId,
    genModal.status,
    genModal.polls,
    genModal.pollAfterMs,
    genModal.seriesId,
    genModal.seasonNumber,
    genModal.episodeNumber,
    router,
  ]);

  const toggleSpoiler = (epNumber: number) => {
    setRevealedSpoilers((prev) => ({
      ...prev,
      [epNumber]: !prev[epNumber],
    }));
  };

  const quizUrl = (seasonNumber: number, episodeNumber: number) =>
    `/episodes/${seriesId}/${seasonNumber}/${episodeNumber}/quiz`;

  const startGeneration = async (
    target: { seasonNumber: number; episodeNumber: number; episodeTitle: string },
    code: string
  ) => {
    setGenModal({
      isOpen: true,
      seriesId,
      ...target,
      jobId: null,
      stage: 'Iniciando solicitação...',
      percentage: 5,
      status: 'queued',
      error: null,
    });

    try {
      const res = await fetch(`/api/episodes/${seriesId}/${target.seasonNumber}/${target.episodeNumber}/quiz`, {
        method: 'POST',
        headers: { 'X-Access-Code': code },
      });

      if (res.status === 401) {
        // Sem pistas sobre o motivo (US-08); o código salvo deixa de valer
        setAccessCode('');
        setCodeDraft('');
        setGenModal((prev) => ({ ...prev, status: 'needs_code', error: 'Código inválido.' }));
        return;
      }

      if (!res.ok) {
        throw new Error(await problemTitle(res, 'Falha ao solicitar criação do quiz'));
      }

      const data = (await res.json()) as GenerateQuizAccepted | GenerateQuizReady;
      if (data.status !== 'ready') {
        setGenModal((prev) => ({
          ...prev,
          jobId: data.jobId,
          status: data.status,
          stage: stageMessage('queued', null),
          percentage: 0,
          pollAfterMs: data.pollAfterMs,
          polls: 0,
        }));
      } else {
        // Already ready!
        setGenModal((prev) => ({
          ...prev,
          stage: 'Quiz pronto!',
          percentage: 100,
          status: 'ready',
        }));
        setTimeout(() => {
          router.push(quizUrl(target.seasonNumber, target.episodeNumber));
        }, 800);
      }
    } catch (err) {
      setGenModal((prev) => ({
        ...prev,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Erro inesperado',
      }));
    }
  };

  const handleGenerateClick = (ep: EpisodeSummary) => {
    const target = { seasonNumber: activeSeason, episodeNumber: ep.episodeNumber, episodeTitle: ep.name };
    if (accessCode) {
      startGeneration(target, accessCode);
      return;
    }

    // Sem código salvo: o modal pede o código antes de chamar a API
    setCodeDraft('');
    setGenModal({
      isOpen: true,
      seriesId,
      ...target,
      jobId: null,
      stage: '',
      percentage: 0,
      status: 'needs_code',
      error: null,
    });
  };

  const handleSubmitCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = codeDraft.trim();
    if (!code) return;
    setAccessCode(code);
    startGeneration(
      {
        seasonNumber: genModal.seasonNumber,
        episodeNumber: genModal.episodeNumber,
        episodeTitle: genModal.episodeTitle,
      },
      code
    );
  };

  if (loadingSeries) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-zinc-400">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
        <p className="mt-2 text-sm">Carregando série...</p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-zinc-400">
        <p>Série não encontrada.</p>
        <Link href="/" className="mt-4 inline-block text-xs text-indigo-400 underline">
          Voltar para busca
        </Link>
      </div>
    );
  }

  // Sort seasons: 1..N first, Season 0 (Specials) at the end
  const sortedSeasons = [...series.seasons].sort((a, b) => {
    if (a.seasonNumber === 0) return 1;
    if (b.seasonNumber === 0) return -1;
    return a.seasonNumber - b.seasonNumber;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
        <ChevronLeft className="h-4 w-4" />
        <span>Voltar para busca</span>
      </Link>

      {/* Series Hero Header */}
      <div className="flex flex-col sm:flex-row gap-5 items-start bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
        <div className="w-28 sm:w-36 flex-shrink-0 mx-auto sm:mx-0">
          <ImageWithFallback
            src={series.posterPath}
            alt={series.name}
            aspectRatio="poster"
            className="rounded-xl shadow-lg border border-zinc-800"
          />
        </div>

        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">{series.name}</h1>
            {!series.isEnglishAudio && (
              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                Áudio original não é inglês
              </span>
            )}
          </div>

          {series.originalName && series.originalName !== series.name && (
            <p className="text-xs text-zinc-500 italic">{series.originalName}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>
              {series.firstAirYear}
              {series.lastAirYear && series.lastAirYear !== series.firstAirYear ? `–${series.lastAirYear}` : ''}
            </span>
            <span>•</span>
            <span>
              {series.numberOfSeasons} temporada{series.numberOfSeasons > 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">
            {series.overview || 'Sem sinopse disponível.'}
          </p>
        </div>
      </div>

      {/* Season Chips Selector */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Temporadas
        </span>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {sortedSeasons.map((s) => {
            const isSelected = s.seasonNumber === activeSeason;
            return (
              <button
                key={s.seasonNumber}
                onClick={() => setActiveSeason(s.seasonNumber)}
                className={`flex-shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                {s.seasonNumber === 0 ? 'Especiais' : `T${s.seasonNumber}`}
                <span className="ml-1.5 opacity-70 font-normal">({s.episodeCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notice about episode numbering across streaming platforms */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2 text-xs text-zinc-400">
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span>
          A numeração pode variar entre serviços de streaming — <strong>confira sempre pelo título</strong> do episódio.
        </span>
      </div>

      {/* Episodes List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          Episódios da {activeSeason === 0 ? 'Temporada de Especiais' : `Temporada ${activeSeason}`}
        </h2>

        {loadingSeason && (
          <div className="py-12 text-center text-zinc-500">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
            <p className="mt-2 text-xs">Carregando episódios...</p>
          </div>
        )}

        {!loadingSeason && seasonData?.episodes && (
          <div className="space-y-3">
            {seasonData.episodes.map((ep) => {
              const isRevealed = revealedSpoilers[ep.episodeNumber];
              const showSpoiler = !noSpoilerMode || isRevealed;

              return (
                <div
                  key={ep.id}
                  className="flex flex-col sm:flex-row gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 hover:border-zinc-700 transition-colors"
                >
                  {/* Still preview 16:9 */}
                  <div className="relative w-full sm:w-44 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-950">
                    <ImageWithFallback
                      src={ep.stillPath}
                      alt={ep.name}
                      aspectRatio="still"
                      className={`w-full transition-all duration-300 ${
                        !showSpoiler ? 'blur-md scale-105 opacity-40' : ''
                      }`}
                    />
                    {!showSpoiler && (
                      <button
                        onClick={() => toggleSpoiler(ep.episodeNumber)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-[11px] font-medium text-zinc-200 hover:bg-black/60 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Ver imagem</span>
                      </button>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                      E{String(ep.episodeNumber).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Episode details */}
                  <div className="flex flex-1 flex-col justify-between space-y-2">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                          <span>{ep.name}</span>
                          {ep.nameLang === 'en' && (
                            <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-400">
                              EN
                            </span>
                          )}
                        </h3>

                        {/* Status Badge */}
                        {ep.quizStatus === 'ready' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Pronto
                          </span>
                        )}
                        {ep.quizStatus === 'generating' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/80 border border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-400 animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Gerando…
                          </span>
                        )}
                        {ep.quizStatus === 'no_subtitle' && (
                          <span className="rounded-full bg-amber-950/80 border border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                            Sem legenda
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {ep.runtimeMinutes} min
                        </span>
                        {ep.airDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {ep.airDate}
                          </span>
                        )}
                      </div>

                      {/* Synopsis (Spoiler-protected) */}
                      <div className="mt-2 text-xs text-zinc-300">
                        {showSpoiler ? (
                          <p className="line-clamp-2 leading-relaxed">
                            {ep.overview || 'Sinopse não disponível.'}
                          </p>
                        ) : (
                          <button
                            onClick={() => toggleSpoiler(ep.episodeNumber)}
                            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Sinopse oculta (Toque para revelar)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/60">
                      {ep.quizStatus === 'ready' ? (
                        <Link
                          href={`/episodes/${seriesId}/${activeSeason}/${ep.episodeNumber}/quiz`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-colors"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Iniciar Quiz</span>
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleGenerateClick(ep)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Gerar Quiz</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Progress Modal */}
      {genModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                Geração do Quiz
              </span>
              <h3 className="text-base font-bold text-zinc-100">
                E{String(genModal.episodeNumber).padStart(2, '0')} · {genModal.episodeTitle}
              </h3>
            </div>

            {genModal.status === 'needs_code' ? (
              /* Access code prompt: generating spends subtitle quota and LLM budget (US-08) */
              <form onSubmit={handleSubmitCode} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="access-code" className="text-xs text-zinc-400 font-medium">
                    Código de acesso
                  </label>
                  <input
                    id="access-code"
                    type="password"
                    autoComplete="off"
                    autoFocus
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    aria-invalid={genModal.error ? true : undefined}
                    aria-describedby="access-code-help"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                  {genModal.error ? (
                    <p id="access-code-help" role="alert" className="text-xs font-medium text-red-400">
                      {genModal.error}
                    </p>
                  ) : (
                    <p id="access-code-help" className="text-[11px] text-zinc-500">
                      Necessário só para gerar quizzes novos. Fica salvo neste aparelho.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGenModal((prev) => ({ ...prev, isOpen: false }))}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!codeDraft.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Gerar quiz</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Progress status */}
                <div className="space-y-2 pt-2" aria-live="polite">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{genModal.stage}</span>
                    <span className="text-zinc-400 font-bold">{genModal.percentage}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${genModal.percentage}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    Você pode sair desta tela ou bloquear o celular. O progresso continuará em segundo plano.
                  </p>
                </div>

                {/* Error handling */}
                {genModal.error && (
                  <div role="alert" className="rounded-lg bg-red-950/50 border border-red-900 p-3 text-xs text-red-300 space-y-1">
                    <p className="font-semibold">Não foi possível gerar:</p>
                    <p>{genModal.error}</p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      if (genModal.status === 'ready') {
                        router.push(quizUrl(genModal.seasonNumber, genModal.episodeNumber));
                      } else {
                        setGenModal((prev) => ({ ...prev, isOpen: false }));
                      }
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    {genModal.status === 'ready' ? 'Ir para o quiz' : 'Fechar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
