'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv, History, Settings, Info, Search, Moon, Sun } from 'lucide-react';
import { useAppStore } from '@shared/store/useAppStore';

const linkBase =
  'flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors';
const linkActive = 'bg-zinc-800 text-zinc-100';
const linkIdle = 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200';

function NavLinks({ pathname }: { pathname: string | null }) {
  const level = useAppStore((s) => s.level);
  const cls = (href: string) => `${linkBase} ${pathname === href ? linkActive : linkIdle}`;

  return (
    <>
      <Link href="/" aria-label="Buscar séries" className={cls('/')}>
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar</span>
      </Link>

      <Link href="/history" aria-label="Histórico" className={cls('/history')}>
        <History className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Histórico</span>
      </Link>

      <Link href="/settings" aria-label={`Configurações (nível ${level})`} className={cls('/settings')}>
        <Settings className="h-3.5 w-3.5" />
        <span className="rounded bg-indigo-950 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-800/50">
          {level}
        </span>
      </Link>

      <Link href="/about" aria-label="Sobre e créditos" title="Sobre e Créditos" className={cls('/about')}>
        <Info className="h-4 w-4" />
      </Link>
    </>
  );
}

// usePathname suspende em rotas com parâmetros dinâmicos (Cache Components); o fallback renderiza sem destaque
function ActiveNavLinks() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

export function Header() {
  const setTheme = useAppStore((s) => s.setTheme);

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
            <Tv className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-zinc-100 text-base">Segunda Tela</span>
            <span className="hidden sm:inline-block ml-2 text-xs text-zinc-400 font-medium">English Quizzes</span>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            title="Alternar tema"
            className={`${linkBase} ${linkIdle}`}
          >
            <Moon className="h-4 w-4 light:hidden" />
            <Sun className="hidden h-4 w-4 light:block" />
          </button>
        </nav>
      </div>
    </header>
  );
}
