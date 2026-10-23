import { NextRequest, NextResponse } from 'next/server';
import { tmdbClient } from '@server/integrations/tmdb/client';
import { getDb, schema } from '@server/lib/db';
import { asc, inArray } from 'drizzle-orm';
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

    const [existingQuizzes, activeJobs] = await Promise.all([
      db
        .select({ episodeKey: schema.quizzes.episodeKey })
        .from(schema.quizzes)
        .where(inArray(schema.quizzes.episodeKey, episodeKeys)),
      db
        .select({
          id: schema.generationJobs.id,
          episodeKey: schema.generationJobs.episodeKey,
          status: schema.generationJobs.status,
          error: schema.generationJobs.error,
        })
        .from(schema.generationJobs)
        .where(inArray(schema.generationJobs.episodeKey, episodeKeys))
        .orderBy(asc(schema.generationJobs.createdAt)),
    ]);

    const quizSet = new Set(existingQuizzes.map((q) => q.episodeKey));
    // Ordenados do mais antigo ao mais recente: o último job de cada episódio prevalece
    const jobsMap = new Map<string, (typeof activeJobs)[number]>();
    for (const j of activeJobs) {
      jobsMap.set(j.episodeKey, j);
    }

    const enrichedEpisodes = seasonData.episodes.map((ep) => {
      const epKey = `tmdb-${seriesId}-s${String(sNum).padStart(2, '0')}-e${String(ep.episodeNumber).padStart(2, '0')}`;
      let quizStatus: EpisodeQuizStatus = 'no_quiz';
      let activeJobId: string | null = null;

      if (quizSet.has(epKey)) {
        quizStatus = 'ready';
      } else {
        const job = jobsMap.get(epKey);
        if (job) {
          if (job.status === 'ready') {
            quizStatus = 'ready';
          } else if (job.status === 'failed' && job.error?.code === 'SUBTITLE_NOT_FOUND') {
            quizStatus = 'no_subtitle';
          } else if (job.status !== 'failed') {
            quizStatus = 'generating';
            activeJobId = job.id;
          }
        }
      }

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
