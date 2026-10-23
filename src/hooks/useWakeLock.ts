'use client';

import { useEffect } from 'react';

// Mantém a tela ligada enquanto `enabled`; o navegador solta o bloqueio quando a aba some, então ele é pedido de novo na volta
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) {
          await next.release();
        } else {
          sentinel = next;
        }
      } catch {
        // Sem suporte, aba oculta ou bateria fraca: o quiz segue normalmente sem o bloqueio
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
