import { NextRequest, NextResponse } from 'next/server';
import { tmdbClient } from '@server/integrations/tmdb/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  if (query.trim().length < 2) {
    return NextResponse.json({ results: [], totalResults: 0, totalPages: 0 });
  }

  try {
    const data = await tmdbClient.searchSeries(query, page);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600', // 1 hour CDN
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'UPSTREAM_UNAVAILABLE', message: (error instanceof Error && error.message) || 'Failed to search series' },
      { status: 502 }
    );
  }
}
