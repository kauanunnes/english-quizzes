import { NextRequest, NextResponse } from 'next/server';
import { tmdbClient } from '@server/integrations/tmdb/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const seriesId = parseInt(id, 10);

  if (isNaN(seriesId)) {
    return NextResponse.json({ error: 'INVALID_ID', message: 'ID da série inválido' }, { status: 400 });
  }

  try {
    const details = await tmdbClient.getSeriesDetails(seriesId);
    return NextResponse.json(details, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600', // 24 hours
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'SERIES_NOT_FOUND', message: 'Série não encontrada' },
      { status: 404 }
    );
  }
}
