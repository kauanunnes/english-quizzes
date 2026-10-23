import { NextRequest, NextResponse } from 'next/server';
import { tmdbClient } from '@server/integrations/tmdb/client';
import { getDb, schema } from '@server/lib/db';
import { and, eq, inArray } from 'drizzle-orm';
import { EpisodeQuizStatus } from '@shared/types/catalog';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; seasonNumber: string }> }
) {
  const { id, seasonNumber } = await params;
  const seriesId = parseInt(id, 10);
  const sNum = parseInt(seasonNumber, 10);

  if (isNaN(seriesId) || isNaN(sNum)) {
    return NextResponse.json({ error: 'INVALID_PARAMS', message: 'Parâmetros inválidos' }, { status: 400 });
  }

  try {
    const seasonData = await tmdbClient.getSeasonDetails(seriesId, sNum);
    const db = await getDb();

    // Query quizzes and jobs for these episodes
    const episodeKeys = seasonData.episodes.map(
      (ep) => `tmdb-${seriesId}-s${String(sNum).padStart(2, '0')}-e${String(ep.episodeNumber).padStart(2, '0')}`
    );

    // Derivação de §5.4 (a rota quiz-status separada entra na Fase 2)
    const [readyQuizzes, activeJobs, episodeRows] = await Promise.all([
      db
        .select({ episodeKey: schema.quizzes.episodeKey })
        .from(schema.quizzes)
        .where(and(inArray(schema.quizzes.episodeKey, episodeKeys), eq(schema.quizzes.status, 'ready'))),
      db
        .select({ id: schema.generationJobs.id, episodeKey: schema.generationJobs.episodeKey })
        .from(schema.generationJobs)
        .where(and(inArray(schema.generationJobs.episodeKey, episodeKeys), inArray(schema.generationJobs.status, ['queued', 'running']))),
      db
        .select({
          episodeKey: schema.episodes.episodeKey,
          subtitleStatus: schema.episodes.subtitleStatus,
          subtitleCheckedAt: schema.episodes.subtitleCheckedAt,
        })
        .from(schema.episodes)
        .where(inArray(schema.episodes.episodeKey, episodeKeys)),
    ]);

    const quizSet = new Set(readyQuizzes.map((q) => q.episodeKey));
    const activeJobByEpisode = new Map(activeJobs.map((j) => [j.episodeKey, j.id]));
    const noSubtitleRecently = new Set(
      episodeRows
        .filter(
          (e) =>
            (e.subtitleStatus === 'not_found' || e.subtitleStatus === 'numbering_mismatch') &&
            e.subtitleCheckedAt !== null &&
            Date.now() - e.subtitleCheckedAt.getTime() < 24 * 3600 * 1000
        )
        .map((e) => e.episodeKey)
    );

    const enrichedEpisodes = seasonData.episodes.map((ep) => {
      const epKey = `tmdb-${seriesId}-s${String(sNum).padStart(2, '0')}-e${String(ep.episodeNumber).padStart(2, '0')}`;
      let quizStatus: EpisodeQuizStatus = 'no_quiz';
      const activeJobId = activeJobByEpisode.get(epKey) ?? null;

      if (quizSet.has(epKey)) quizStatus = 'ready';
      else if (activeJobId) quizStatus = 'generating';
      else if (noSubtitleRecently.has(epKey)) quizStatus = 'no_subtitle';

      return {
        ...ep,
        quizStatus,
        activeJobId,
      };
    });

    return NextResponse.json({
      ...seasonData,
      episodes: enrichedEpisodes,
    });
  } catch {
    return NextResponse.json(
      { error: 'SEASON_NOT_FOUND', message: 'Temporada não encontrada' },
      { status: 404 }
    );
  }
}
