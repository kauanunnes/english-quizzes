'use client';

import { useState } from 'react';
import { KeyRound, Monitor, Moon, Sun, Trash2, type LucideIcon } from 'lucide-react';
import { CefrLevel } from '@shared/types/quiz';
import { ThemePreference, useAppStore } from '@shared/store/useAppStore';

const LEVELS: { value: CefrLevel; title: string; description: string }[] = [
  { value: 'A2', title: 'A2 · Básico', description: 'Fatos diretos, frases simples e vocabulário do dia a dia.' },
  { value: 'B1', title: 'B1 · Intermediário', description: 'Ideia principal da conversa e expressões comuns.' },
  { value: 'B2', title: 'B2 · Intermediário avançado', description: 'Nuances, phrasal verbs, humor e entrelinhas.' },
  { value: 'C1', title: 'C1 · Avançado', description: 'Inferência, ironia e subtexto cultural.' },
];

const THEMES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
];

function SettingSwitch({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium text-zinc-100 cursor-pointer">
          {label}
        </label>
        <p id={`${id}-desc`} className="text-xs text-zinc-400">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className="flex h-11 w-14 flex-shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <span
          className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-zinc-700'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
      </button>
    </div>
  );
}

const sectionClass = 'rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-3';
const sectionTitleClass = 'text-xs font-semibold text-zinc-500 uppercase tracking-wider';

export default function SettingsPage() {
  const {
    level,
    setLevel,
    includeNeighborLevels,
    setIncludeNeighborLevels,
    noSpoilerMode,
    setNoSpoilerMode,
    theme,
    setTheme,
    ptExplanationDefault,
    setPtExplanationDefault,
    keepScreenAwake,
    setKeepScreenAwake,
    accessCode,
    setAccessCode,
    attempts,
    resetAllData,
  } = useAppStore();

  const [codeDraft, setCodeDraft] = useState('');

  const handleSaveCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!codeDraft.trim()) return;
    setAccessCode(codeDraft);
    setCodeDraft('');
  };

  const handleResetAll = () => {
    if (confirm('Apagar histórico, configurações e código de acesso deste aparelho? Isso não pode ser desfeito.')) {
      resetAllData();
      setCodeDraft('');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Configurações</h1>
        <p className="text-xs text-zinc-400">Salvas só neste aparelho. Valem na hora, sem gerar nada de novo.</p>
      </div>

      {/* Level (US-12) */}
      <fieldset className={sectionClass}>
        <legend className={`${sectionTitleClass} float-left w-full pb-1`}>Nível das perguntas</legend>
        <div className="clear-both grid gap-2 sm:grid-cols-2">
          {LEVELS.map((item) => {
            const isSelected = level === item.value;
            return (
              <label
                key={item.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={item.value}
                  checked={isSelected}
                  onChange={() => setLevel(item.value)}
                  className="mt-0.5 h-4 w-4 accent-indigo-500"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold text-zinc-100">{item.title}</span>
                  <span className="block text-xs text-zinc-400">{item.description}</span>
                </span>
              </label>
            );
          })}
        </div>

        <SettingSwitch
          id="neighbor-levels"
          label="Incluir níveis vizinhos (±1)"
          description="Mostra também as perguntas do nível abaixo e do acima, para quizzes mais longos."
          checked={includeNeighborLevels}
          onChange={setIncludeNeighborLevels}
        />
      </fieldset>

      {/* Quiz experience (US-10, US-15) */}
      <section className={sectionClass} aria-labelledby="quiz-settings-title">
        <h2 id="quiz-settings-title" className={sectionTitleClass}>
          Durante o quiz
        </h2>
        <div className="divide-y divide-zinc-800/80">
          <SettingSwitch
            id="no-spoiler"
            label="Modo sem spoiler"
            description="Esconde sinopses e imagens dos episódios até você tocar para revelar."
            checked={noSpoilerMode}
            onChange={setNoSpoilerMode}
          />
          <SettingSwitch
            id="pt-explanation"
            label="Explicação em português por padrão"
            description="Você ainda pode alternar para o inglês em cada pergunta."
            checked={ptExplanationDefault}
            onChange={setPtExplanationDefault}
          />
          <SettingSwitch
            id="keep-awake"
            label="Manter a tela ligada"
            description="Impede o celular de bloquear enquanto o quiz estiver aberto, quando o navegador permite."
            checked={keepScreenAwake}
            onChange={setKeepScreenAwake}
          />
        </div>
      </section>

      {/* Theme */}
      <fieldset className={sectionClass}>
        <legend className={`${sectionTitleClass} float-left w-full pb-1`}>Tema</legend>
        <div className="clear-both grid grid-cols-3 gap-2">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const isSelected = theme === value;
            return (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={isSelected}
                  onChange={() => setTheme(value)}
                  className="sr-only"
                />
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Access code (US-08) */}
      <section className={sectionClass} aria-labelledby="access-code-title">
        <h2 id="access-code-title" className={sectionTitleClass}>
          Código de acesso
        </h2>
        <p className="text-xs text-zinc-400">
          Necessário só para gerar quizzes novos. Sem ele, você responde normalmente os quizzes que já existem.
        </p>

        {accessCode ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-xs text-zinc-300">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              Código salvo neste aparelho
            </span>
            <button
              type="button"
              onClick={() => setAccessCode('')}
              className="min-h-11 rounded-lg px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              Remover
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveCode} className="flex gap-2">
            <label htmlFor="settings-access-code" className="sr-only">
              Código de acesso
            </label>
            <input
              id="settings-access-code"
              type="password"
              autoComplete="off"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)}
              placeholder="Digite o código"
              className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!codeDraft.trim()}
              className="rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              Salvar
            </button>
          </form>
        )}
      </section>

      {/* Local data */}
      <section className={sectionClass} aria-labelledby="local-data-title">
        <h2 id="local-data-title" className={sectionTitleClass}>
          Dados deste aparelho
        </h2>
        <p className="text-xs text-zinc-400">
          {attempts.length === 1 ? '1 tentativa salva' : `${attempts.length} tentativas salvas`} no histórico. Apagar
          também volta as configurações ao padrão e remove o código de acesso.
        </p>
        <button
          type="button"
          onClick={handleResetAll}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/40 px-4 text-xs font-semibold text-red-400 hover:bg-red-900/60 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span>Apagar dados locais</span>
        </button>
      </section>
    </div>
  );
}
