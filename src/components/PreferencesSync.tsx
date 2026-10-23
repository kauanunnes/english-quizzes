'use client';

import { useLayoutEffect } from 'react';
import { useAppStore } from '@shared/store/useAppStore';
import { applyTheme } from '@/components/theme';

export function PreferencesSync() {
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const syncTheme = () => applyTheme(useAppStore.getState().theme);

    // Mudanças de tema vindas da reidratação ou das configurações reaplicam o data-theme
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.theme !== prev.theme) syncTheme();
    });
    media.addEventListener('change', syncTheme);

    // O store pula a hidratação automática para não divergir do HTML do servidor
    void useAppStore.persist.rehydrate();
    // Também reaplica depois do remount do Strict Mode, que limpa atributos do <html> em dev
    syncTheme();

    return () => {
      unsubscribe();
      media.removeEventListener('change', syncTheme);
    };
  }, []);

  return null;
}
