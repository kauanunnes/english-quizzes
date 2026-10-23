import { Loader2 } from 'lucide-react';

// Com Cache Components, loading.tsx é o <Suspense> que permite à página ler params dinâmicos
export default function QuizLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center text-zinc-400">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
      <p className="mt-3 text-sm font-medium">Carregando quiz do episódio...</p>
    </div>
  );
}
