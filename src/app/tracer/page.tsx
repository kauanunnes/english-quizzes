import type { Metadata } from 'next';
import { env } from '@server/env';
import { TracerClient } from './TracerClient';

export const metadata: Metadata = {
  title: 'Tracer (Fase 1)',
  robots: { index: false },
};

// Fase 1 (docs/10 F1): episódio fixo. Padrão: Victorious S01E04, o episódio com legenda EN encontrado pelo os-probe
export default function TracerPage() {
  return (
    <TracerClient
      seriesId={env.TRACER_SERIES_ID ?? 31251}
      seasonNumber={env.TRACER_SEASON ?? 1}
      episodeNumber={env.TRACER_EPISODE ?? 4}
      tracerOnly={env.TRACER_ONLY}
    />
  );
}
