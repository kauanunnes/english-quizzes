// server/integrations/tmdb/mappers.ts
import { SeriesSearchResult, SeriesDetails, SeasonDetails, EpisodeSummary } from '@shared/types/catalog';
import { TmdbTvSearchResult, TmdbTvDetails, TmdbSeasonDetails, TmdbEpisodeInfo } from './types';

export function mapSearchResult(item: TmdbTvSearchResult): SeriesSearchResult {
  const name = item.name || item.original_name;
  const firstAirYear = item.first_air_date ? item.first_air_date.substring(0, 4) : null;

  return {
    id: item.id,
    name,
    originalName: item.original_name,
    firstAirYear,
    posterPath: item.poster_path ?? null,
    overview: item.overview || '',
    originalLanguage: item.original_language,
    isEnglishAudio: item.original_language === 'en',
  };
}

export function mapSeriesDetails(details: TmdbTvDetails): SeriesDetails {
  const name = details.name || details.original_name;
  const firstAirYear = details.first_air_date ? details.first_air_date.substring(0, 4) : null;
  const lastAirYear = details.last_air_date ? details.last_air_date.substring(0, 4) : null;

  return {
    id: details.id,
    name,
    originalName: details.original_name,
    overview: details.overview || '',
    posterPath: details.poster_path ?? null,
    backdropPath: details.backdrop_path ?? null,
    firstAirYear,
    lastAirYear,
    numberOfSeasons: details.number_of_seasons,
    originalLanguage: details.original_language,
    isEnglishAudio: details.original_language === 'en',
    seasons: details.seasons.map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      airDate: s.air_date ?? null,
      posterPath: s.poster_path ?? null,
    })),
    imdbId: details.external_ids?.imdb_id ?? null,
  };
}

export function mapEpisode(
  epPt: TmdbEpisodeInfo,
  epEn?: TmdbEpisodeInfo
): EpisodeSummary {
  let name = epPt.name;
  let nameLang: 'pt' | 'en' = 'pt';

  // Check if pt-BR title is generic like "Episódio 1"
  if (/^epis[oó]dio\s+\d+$/i.test(name.trim()) && epEn && epEn.name) {
    name = epEn.name;
    nameLang = 'en';
  }

  let overview = epPt.overview;
  let overviewLang: 'pt' | 'en' = 'pt';

  if (!overview && epEn && epEn.overview) {
    overview = epEn.overview;
    overviewLang = 'en';
  }

  return {
    id: epPt.id,
    episodeNumber: epPt.episode_number,
    seasonNumber: epPt.season_number,
    name,
    nameLang,
    overview: overview || '',
    overviewLang,
    stillPath: epPt.still_path ?? null,
    runtimeMinutes: epPt.runtime ?? 22,
    airDate: epPt.air_date ?? null,
    quizStatus: 'no_quiz',
  };
}

export function mapSeasonDetails(
  seriesId: number,
  seasonPt: TmdbSeasonDetails,
  seasonEn?: TmdbSeasonDetails
): SeasonDetails {
  const enEpisodesMap = new Map<number, TmdbEpisodeInfo>();
  if (seasonEn?.episodes) {
    for (const ep of seasonEn.episodes) {
      enEpisodesMap.set(ep.episode_number, ep);
    }
  }

  const episodes = seasonPt.episodes.map((epPt) => {
    const epEn = enEpisodesMap.get(epPt.episode_number);
    return mapEpisode(epPt, epEn);
  });

  return {
    seriesId,
    seasonNumber: seasonPt.season_number,
    name: seasonPt.name,
    overview: seasonPt.overview || '',
    posterPath: seasonPt.poster_path ?? null,
    episodes,
  };
}
