import { Loader2 } from 'lucide-react';

// Com Cache Components, loading.tsx é o <Suspense> que permite à página ler params dinâmicos
export default function SeriesLoading() {
  return (
    <div className="mx-auto max-w-4xl p-8 text-center text-zinc-400">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
      <p className="mt-2 text-sm">Carregando série...</p>
    </div>
  );
}
