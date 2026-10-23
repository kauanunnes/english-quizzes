'use client';

import { useAppStore } from '@shared/store/useAppStore';
import Link from 'next/link';
import { History, Calendar, Download, Trash2, ChevronRight } from 'lucide-react';

export default function HistoryPage() {
  const { attempts, clearHistory } = useAppStore();

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(attempts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `segunda-tela-historico-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const totalAttempts = attempts.length;
  const avgPercentage =
    totalAttempts > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.percentage, 0) / totalAttempts)
      : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Histórico de Quizzes</h1>
          <p className="text-xs text-zinc-400">Suas tentativas salvas localmente neste aparelho.</p>
        </div>

        {totalAttempts > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              title="Exportar histórico em JSON"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Tem certeza que deseja apagar todo o histórico deste aparelho?')) {
                  clearHistory();
                }
              }}
              title="Apagar histórico"
              className="rounded-lg border border-red-900/50 bg-red-950/40 p-1.5 text-xs text-red-400 hover:bg-red-900/60 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Quizzes Realizados
          </span>
          <p className="text-2xl font-bold text-zinc-100">{totalAttempts}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Média de Acertos
          </span>
          <p className="text-2xl font-bold text-emerald-400">{avgPercentage}%</p>
        </div>
      </div>

      {/* Attempts List */}
      {totalAttempts === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-3">
          <History className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-300">Nenhum quiz concluído ainda</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Procure sua série favorita na busca e responda ao quiz enquanto assiste ao episódio.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors mt-2"
          >
            <span>Buscar séries</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((att) => (
            <Link
              key={att.id}
              href={`/episodes/${att.seriesId}/${att.seasonNumber}/${att.episodeNumber}/quiz`}
              className="group flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                    {att.seriesTitle}
                  </span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-300">
                    S{String(att.seasonNumber).padStart(2, '0')}E{String(att.episodeNumber).padStart(2, '0')}
                  </span>
                  <span className="rounded bg-indigo-950 text-indigo-400 border border-indigo-800/40 px-1.5 py-0.5 text-[10px] font-bold">
                    {att.level}
                  </span>
                </div>

                <p className="text-xs text-zinc-400">{att.episodeTitle}</p>

                <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-0.5">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(att.date).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400">{att.percentage}%</span>
                  <p className="text-[10px] text-zinc-500">
                    {att.correctAnswers}/{att.totalQuestions} acertos
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
