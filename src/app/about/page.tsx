import type { Metadata } from 'next';
import { Bot, Clapperboard, ExternalLink, Server, Smartphone, Subtitles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sobre e créditos',
};

const cardClass = 'rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-2';
const sectionTitleClass = 'text-xs font-semibold text-zinc-500 uppercase tracking-wider';
const externalLinkClass =
  'inline-flex items-center gap-1 font-medium text-indigo-400 underline underline-offset-2 hover:text-indigo-300';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Sobre e créditos</h1>
        <p className="text-sm text-zinc-300 leading-relaxed">
          A Segunda Tela é um projeto pessoal e sem fins comerciais para treinar listening em inglês. Você assiste ao
          episódio onde quiser e, a cada bloco de cerca de 5 minutos, responde no celular perguntas sobre o que acabou de
          ouvir, sem spoiler do que vem depois.
        </p>
      </div>

      {/* Credits (US-16) */}
      <section className="space-y-3" aria-labelledby="credits-title">
        <h2 id="credits-title" className={sectionTitleClass}>
          Créditos
        </h2>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Clapperboard className="h-4 w-4 text-zinc-400" />
            <span>Catálogo de séries</span>
          </div>
          {/* TODO(§4.1.7): incluir o logo aprovado da TMDB (themoviedb.org/about/logos-attribution), menos proeminente que a marca do app */}
          <p className="text-xs text-zinc-300 leading-relaxed">
            Séries, temporadas, episódios e imagens vêm do{' '}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className={externalLinkClass}>
              The Movie Database (TMDB)
              <ExternalLink className="h-3 w-3" />
            </a>
            .
          </p>
          <p lang="en" className="text-xs text-zinc-400">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Subtitles className="h-4 w-4 text-zinc-400" />
            <span>Legendas</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Legendas:{' '}
            <a href="https://www.opensubtitles.com" target="_blank" rel="noopener noreferrer" className={externalLinkClass}>
              OpenSubtitles.com
              <ExternalLink className="h-3 w-3" />
            </a>
            . O texto é usado só para criar as perguntas e é descartado em seguida.
          </p>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Bot className="h-4 w-4 text-zinc-400" />
            <span>Perguntas</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            As perguntas são geradas por IA e podem conter erros. Cada uma traz o trecho do diálogo que a justifica e o
            horário aproximado em que ele aparece, para você conferir.
          </p>
        </div>
      </section>

      {/* Privacy summary */}
      <section className="space-y-3" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className={sectionTitleClass}>
          Privacidade
        </h2>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Smartphone className="h-4 w-4 text-zinc-400" />
            <span>Fica no seu aparelho</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Configurações, histórico de tentativas, buscas recentes, código de acesso e um identificador anônimo do
            aparelho. Nada disso fica guardado no servidor; o código de acesso só é enviado quando você gera um quiz. Dá
            para apagar tudo em Configurações.
          </p>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Server className="h-4 w-4 text-zinc-400" />
            <span>Fica no servidor</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Os quizzes gerados (perguntas, explicações e citações curtas do diálogo), o andamento de cada geração e qual
            arquivo de legenda foi usado. O texto da legenda nunca é guardado. Não há login nem coleta de nome ou e-mail.
          </p>
        </div>
      </section>
    </div>
  );
}
