'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, X, AlertCircle, Sparkles, ChevronRight } from 'lucide-react';
import { SeriesSearchResult } from '@shared/types/catalog';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { useAppStore } from '@shared/store/useAppStore';

export default function SearchPage() {
  const { recentSearches, addRecentSearch } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SeriesSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Respostas que chegam fora de ordem não sobrescrevem a busca mais recente
  const latestRequestId = useRef(0);

  const executeSearch = useCallback(async (searchTerm: string) => {
    const term = searchTerm.trim();
    if (term.length < 2) return;

    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/series/search?query=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error('Falha ao buscar séries');
      const data = await res.json();
      if (requestId !== latestRequestId.current) return;
      setResults(data.results || []);
      setHasSearched(true);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;
      setError(err instanceof Error ? err.message : 'Erro ao conectar à API');
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;

    debounceTimer.current = setTimeout(() => {
      executeSearch(query);
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, executeSearch]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      latestRequestId.current++;
      setResults([]);
      setHasSearched(false);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      addRecentSearch(query);
      executeSearch(query);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Hero presentation */}
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Pratique listening assistindo na TV
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl">
          Escolha um episódio de série em inglês. Geramos perguntas divididas em blocos de 5 minutos, sem spoilers, direto no seu celular.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
          <Search className="h-5 w-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Busque uma série (ex: Victorious, Friends, The Office)..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-3.5 pl-11 pr-10 text-sm text-zinc-100 placeholder-zinc-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => handleQueryChange('')}
            aria-label="Limpar busca"
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Recent Searches Chips */}
      {recentSearches.length > 0 && !hasSearched && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Buscas recentes
          </span>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleQueryChange(term)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => executeSearch(query)}
            className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[2/3] rounded-lg bg-zinc-800/60" />
              <div className="h-4 w-3/4 rounded bg-zinc-800/60" />
              <div className="h-3 w-1/2 rounded bg-zinc-800/40" />
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {!loading && hasSearched && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              {results.length} resultado{results.length > 1 ? 's' : ''} encontrado{results.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {results.map((series) => (
              <Link
                key={series.id}
                href={`/series/${series.id}`}
                onClick={() => addRecentSearch(query)}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-500/50 hover:bg-zinc-900/80 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="relative overflow-hidden">
                  <ImageWithFallback
                    src={series.posterPath}
                    alt={series.name}
                    aspectRatio="poster"
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                  {!series.isEnglishAudio && (
                    <span className="absolute top-2 left-2 rounded bg-amber-500/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-black shadow">
                      Áudio não-EN
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3 space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-indigo-400 transition-colors">
                    {series.name}
                  </h3>
                  {series.originalName && series.originalName !== series.name && (
                    <p className="text-xs text-zinc-500 line-clamp-1 italic">
                      {series.originalName}
                    </p>
                  )}
                  <div className="mt-auto pt-1 flex items-center justify-between text-xs text-zinc-400">
                    <span>{series.firstAirYear || 'N/A'}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
          <Sparkles className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-300 font-medium">
            Nenhuma série encontrada para &ldquo;{query}&rdquo;
          </p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Verifique a ortografia ou tente pesquisar pelo título original em inglês.
          </p>
        </div>
      )}
    </div>
  );
}
