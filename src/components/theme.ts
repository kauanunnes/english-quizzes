import { APP_STORE_KEY, DEFAULT_THEME, ThemePreference } from '@shared/store/useAppStore';

export type ResolvedTheme = 'light' | 'dark';

// Tema usado no HTML do servidor; o script abaixo corrige antes da primeira pintura
export const SERVER_THEME: ResolvedTheme = 'dark';

// Roda no <head> durante o parse do HTML: lê a preferência salva pelo store e aplica data-theme sem flash
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(APP_STORE_KEY)})||"{}").state;var t=(s&&s.theme)||${JSON.stringify(DEFAULT_THEME)};if(t==="system")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(preference: ThemePreference) {
  document.documentElement.setAttribute('data-theme', resolveTheme(preference));
}
