import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      imageBaseUrl: 'https://image.tmdb.org/t/p',
      posterSizes: ['w154', 'w342', 'w500', 'original'],
      stillSizes: ['w185', 'w300', 'original'],
      version: '0.1.0',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400', // 7 days
      },
    }
  );
}
