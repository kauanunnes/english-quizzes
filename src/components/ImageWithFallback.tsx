'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  size?: 'w154' | 'w342' | 'w500' | 'w185' | 'w300';
  className?: string;
  aspectRatio?: 'poster' | 'still' | 'backdrop';
}

export function ImageWithFallback({
  src,
  alt,
  size = 'w342',
  className = '',
  aspectRatio = 'poster',
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  const aspectClass =
    aspectRatio === 'poster'
      ? 'aspect-[2/3]'
      : aspectRatio === 'still'
      ? 'aspect-[16/9]'
      : 'aspect-[16/9]';

  const fullUrl = src && !error ? `https://image.tmdb.org/t/p/${size}${src}` : null;

  return (
    <div
      className={`relative overflow-hidden bg-zinc-900 flex items-center justify-center ${aspectClass} ${className}`}
    >
      {fullUrl ? (
        // Imagens vêm direto de image.tmdb.org, sem passar pelo otimizador do Next (ADR-010: nunca copiar/cachear)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fullUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setError(true)}
          className="h-full w-full object-cover transition-opacity duration-300"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-zinc-600">
          <Film className="h-6 w-6 stroke-[1.5]" />
          <span className="text-[10px] font-medium text-center line-clamp-1">{alt}</span>
        </div>
      )}
    </div>
  );
}
