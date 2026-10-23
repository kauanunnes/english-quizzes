import { getDb, schema } from '@server/lib/db';
import { eq } from 'drizzle-orm';
import { tmdbClient } from '@server/integrations/tmdb/client';
import { openSubtitlesClient } from '@server/integrations/opensubtitles/client';
import { parseSrtOrVtt } from '@server/domain/subtitles/parser';
import { segmentDialogueLines } from '@server/domain/subtitles/segmenter';
import { evaluateSubtitleQuality } from '@server/domain/subtitles/qa';
import { generateQuizForEpisode } from '@server/domain/quiz/generator';
import { logger } from '@server/lib/logger';
import { HttpError } from '@server/lib/http';
import { JobError, JobProgress, JobStatus } from '@shared/types/job';

export interface RunJobParams {
  jobId: string;
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  uploadedSubtitle?: string; // MVP+ upload manual
}

export async function runGenerationJob(params: RunJobParams): Promise<void> {
  const { jobId, seriesId, seasonNumber, episodeNumber, uploadedSubtitle } = params;
  const episodeKey = `tmdb-${seriesId}-s${String(seasonNumber).padStart(2, '0')}-e${String(episodeNumber).padStart(2, '0')}`;
  const db = await getDb();

  const updateJob = async (fields: {
    status?: JobStatus;
    stage?: string;
    progress?: JobProgress;
    error?: JobError | null;
    finishedAt?: Date | null;
  }) => {
    await db
      .update(schema.generationJobs)
      .set({
        ...fields,
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJobs.id, jobId));
  };

  try {
    logger.info('Starting generation job runner', { jobId, episodeKey });

    // 1. Stage: resolving
    await updateJob({
      status: 'resolving',
      stage: 'Obtendo detalhes do episódio...',
      progress: { percentage: 10, message: 'Consultando catálogo TMDB' },
    });

    const [seriesDetails, epDetailsEn] = await Promise.all([
      tmdbClient.getSeriesDetails(seriesId),
      tmdbClient.getEpisodeDetailsEn(seriesId, seasonNumber, episodeNumber),
    ]);

    let subtitleContent = uploadedSubtitle || '';
    let chosenStrategy = uploadedSubtitle ? 'upload' : 'opensubtitles';
    let fileId: number | null = null;

    if (!subtitleContent) {
      // 2. Stage: searching
      await updateJob({
        status: 'searching',
        stage: 'Procurando legenda em inglês...',
        progress: { percentage: 25, message: 'Buscando legendas sincronizadas' },
      });

      const { candidates, strategy } = await openSubtitlesClient.findBestCandidates({
        seriesId,
        seriesTitle: seriesDetails.originalName || seriesDetails.name,
        seasonNumber,
        episodeNumber,
        episodeTitleEn: epDetailsEn.name,
        seriesImdbId: seriesDetails.imdbId,
        episodeImdbId: epDetailsEn.imdbId,
      });

      if (candidates.length === 0) {
        await updateJob({
          status: 'failed',
          stage: 'Legenda não encontrada',
          progress: { percentage: 100, message: 'Não achamos legenda em inglês para este episódio.' },
          error: {
            code: 'SUBTITLE_NOT_FOUND',
            message: 'Não achamos legenda em inglês para este episódio.',
            action: 'Envie um arquivo .srt/.vtt manualmente ou tente novamente mais tarde.',
          },
          finishedAt: new Date(),
        });
        return;
      }

      chosenStrategy = strategy;
      const topCandidate = candidates[0];
      fileId = topCandidate.item.attributes.files[0]?.file_id;

      // 3. Stage: downloading
      await updateJob({
        status: 'downloading',
        stage: 'Baixando legenda...',
        progress: { percentage: 40, message: 'Fazendo download seguro da legenda' },
      });

      try {
        const downloadResult = await openSubtitlesClient.downloadSubtitle(fileId);
        subtitleContent = downloadResult.content;
      } catch (err) {
        if (err instanceof HttpError && err.status === 406) {
          await updateJob({
            status: 'failed',
            stage: 'Cota de legendas esgotada',
            progress: { percentage: 100, message: 'A cota diária de legendas acabou.' },
            error: {
              code: 'SUBTITLE_QUOTA_EXCEEDED',
              message: 'A cota diária de legendas acabou. Renova em breve.',
              action: 'Aguarde a renovação da cota ou faça upload manual do arquivo .srt/.vtt.',
            },
            finishedAt: new Date(),
          });
          return;
        }
        throw err;
      }
    }

    // 4. Stage: parsing & QA
    await updateJob({
      status: 'parsing',
      stage: 'Limpando e validando o texto...',
      progress: { percentage: 50, message: 'Removendo ruídos e legendas cantadas' },
    });

    const parsed = parseSrtOrVtt(subtitleContent);
    const qa = evaluateSubtitleQuality(parsed.lines, epDetailsEn.runtime);

    if (!qa.passed) {
      logger.warn('Subtitle failed QA', { jobId, reason: qa.reason });
      await updateJob({
        status: 'failed',
        stage: 'Legenda com qualidade insuficiente',
        progress: { percentage: 100, message: 'Legenda rejeitada pelo controle de qualidade.' },
        error: {
          code: 'SUBTITLE_UNUSABLE',
          message: qa.reason || 'A legenda baixada não atende aos padrões de qualidade ou duração.',
          action: 'Envie um arquivo .srt sincronizado manualmente.',
        },
        finishedAt: new Date(),
      });
      return;
    }

    // Segment lines into ~5-minute blocks
    const segments = segmentDialogueLines(parsed.lines, { targetMinutes: 5 });

    // 5. Stage: generating
    await updateJob({
      status: 'generating',
      stage: 'Criando perguntas do quiz...',
      progress: { percentage: 60, message: `Criando perguntas (0/${segments.length} blocos)` },
    });

    const quizDocument = await generateQuizForEpisode({
      jobId,
      seriesId,
      seriesTitle: seriesDetails.name,
      seasonNumber,
      episodeNumber,
      episodeTitle: epDetailsEn.name,
      runtimeMinutes: epDetailsEn.runtime,
      segments,
      onProgress: async (completed, total) => {
        const pct = Math.round(60 + (completed / total) * 30);
        await updateJob({
          progress: {
            percentage: pct,
            currentSegment: completed,
            totalSegments: total,
            message: `Criando perguntas (${completed}/${total} blocos)`,
          },
        });
      },
    });

    // 6. Stage: validating & saving
    await updateJob({
      status: 'validating',
      stage: 'Conferindo perguntas...',
      progress: { percentage: 95, message: 'Validando evidências e ausência de spoilers' },
    });

    // Save quiz to db
    await db.insert(schema.quizzes).values({
      id: `quiz_${episodeKey}`,
      episodeKey,
      seriesId,
      seasonNumber,
      episodeNumber,
      document: quizDocument,
      usage: quizDocument.usage,
      createdAt: new Date(),
    });

    // Save selection record
    await db.insert(schema.subtitleSelections).values({
      id: `sub_${jobId}`,
      episodeKey,
      strategy: chosenStrategy,
      fileId,
      accepted: true,
      createdAt: new Date(),
    });

    // 7. Ready!
    await updateJob({
      status: 'ready',
      stage: 'Pronto!',
      progress: { percentage: 100, message: 'Quiz gerado com sucesso!' },
      finishedAt: new Date(),
    });

    logger.info('Generation job finished successfully', { jobId, episodeKey });
  } catch (error) {
    logger.error('Generation job failed with unhandled error', { jobId, episodeKey }, error);

    await updateJob({
      status: 'failed',
      stage: 'Erro na geração',
      progress: { percentage: 100, message: 'Ocorreu um erro durante a criação do quiz.' },
      error: {
        code: 'INTERNAL_ERROR',
        message: (error instanceof Error && error.message) || 'Erro inesperado na geração do quiz.',
        action: 'Tente novamente em alguns instantes.',
      },
      finishedAt: new Date(),
    });
  }
}
