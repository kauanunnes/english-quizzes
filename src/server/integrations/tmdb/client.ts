import { env } from '@server/env';
import { fetchJson } from '@server/lib/http';
import { logger } from '@server/lib/logger';
import {
  SeriesSearchResult,
  SeriesDetails,
  SeasonDetails,
} from '@shared/types/catalog';
import {
  TmdbSearchTvResponse,
  TmdbTvDetails,
  TmdbSeasonDetails,
  TmdbEpisodeInfo,
} from './types';
import {
  mapSearchResult,
  mapSeriesDetails,
  mapSeasonDetails,
} from './mappers';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const MOCK_SERIES: SeriesDetails[] = [
  {
    id: 31586,
    name: 'Victorious',
    originalName: 'Victorious',
    overview: 'Tori Vega é uma adolescente de 16 anos que inesperadamente entra na renomada Hollywood Arts High School após substituir sua irmã mais velha em uma apresentação.',
    posterPath: '/4b72j6fNchv257Zdr8Wf8i7Y7jS.jpg',
    backdropPath: '/8rCqGZzRjJ6U1eYc9oXW8h8K6B6.jpg',
    firstAirYear: '2010',
    lastAirYear: '2013',
    numberOfSeasons: 4,
    originalLanguage: 'en',
    isEnglishAudio: true,
    imdbId: 'tt1604099',
    seasons: [
      { seasonNumber: 1, name: 'Temporada 1', episodeCount: 20, airDate: '2010-03-27', posterPath: null },
      { seasonNumber: 2, name: 'Temporada 2', episodeCount: 14, airDate: '2011-04-02', posterPath: null },
      { seasonNumber: 3, name: 'Temporada 3', episodeCount: 14, airDate: '2012-01-28', posterPath: null },
      { seasonNumber: 4, name: 'Temporada 4', episodeCount: 13, airDate: '2012-09-22', posterPath: null },
    ],
  },
  {
    id: 1668,
    name: 'Friends',
    originalName: 'Friends',
    overview: 'Seis jovens amigos enfrentam os altos e baixos da vida profissional e amorosa em Manhattan nos anos 1990.',
    posterPath: '/f496cm9enuEsZkSPghkkHgHNQMr.jpg',
    backdropPath: '/l0qVZIpXtIo7km9u5YAV0ecIETm.jpg',
    firstAirYear: '1994',
    lastAirYear: '2004',
    numberOfSeasons: 10,
    originalLanguage: 'en',
    isEnglishAudio: true,
    imdbId: 'tt0108778',
    seasons: [
      { seasonNumber: 1, name: 'Temporada 1', episodeCount: 24, airDate: '1994-09-22', posterPath: null },
      { seasonNumber: 2, name: 'Temporada 2', episodeCount: 24, airDate: '1995-09-21', posterPath: null },
    ],
  },
];

const MOCK_EPISODES: Record<string, SeasonDetails> = {
  '31586-1': {
    seriesId: 31586,
    seasonNumber: 1,
    name: 'Temporada 1',
    overview: 'A primeira temporada de Victorious.',
    posterPath: null,
    episodes: [
      {
        id: 101,
        episodeNumber: 1,
        seasonNumber: 1,
        name: 'Pilot',
        nameLang: 'en',
        overview: 'Tori Vega substitui sua irmã Trina em uma grande apresentação escolar e ganha uma vaga na Hollywood Arts.',
        overviewLang: 'pt',
        stillPath: null,
        runtimeMinutes: 24,
        airDate: '2010-03-27',
        quizStatus: 'no_quiz',
      },
      {
        id: 102,
        episodeNumber: 2,
        seasonNumber: 1,
        name: 'The Bird Scene',
        nameLang: 'en',
        overview: 'Tori precisa passar no famoso monólogo do Pássaro para poder atuar em qualquer peça do professor Sikowitz.',
        overviewLang: 'pt',
        stillPath: null,
        runtimeMinutes: 23,
        airDate: '2010-04-11',
        quizStatus: 'no_quiz',
      },
      {
        id: 103,
        episodeNumber: 3,
        seasonNumber: 1,
        name: 'Stage Fighting',
        nameLang: 'en',
        overview: 'Tori é acusada de agredir Jade de verdade durante um ensaio de luta cênica.',
        overviewLang: 'pt',
        stillPath: null,
        runtimeMinutes: 22,
        airDate: '2010-04-18',
        quizStatus: 'no_quiz',
      },
      {
        id: 104,
        episodeNumber: 4,
        seasonNumber: 1,
        name: 'The Birthweek Song',
        nameLang: 'en',
        overview: 'Tori se desespera para dar um presente marcante no aniversário de Trina e decide compor uma música.',
        overviewLang: 'pt',
        stillPath: null,
        runtimeMinutes: 23,
        airDate: '2010-04-25',
        quizStatus: 'no_quiz',
      },
    ],
  },
};

export class TmdbClient {
  private readToken?: string;

  constructor() {
    this.readToken = env.TMDB_READ_TOKEN;
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.readToken}`,
      Accept: 'application/json',
    };
  }

  async searchSeries(query: string, page = 1): Promise<{ results: SeriesSearchResult[]; totalResults: number; totalPages: number }> {
    if (env.MOCK_UPSTREAMS) {
      const q = query.toLowerCase().trim();
      const matched = MOCK_SERIES.filter((s) => s.name.toLowerCase().includes(q) || s.originalName.toLowerCase().includes(q));
      return {
        results: matched.map((s) => ({
          id: s.id,
          name: s.name,
          originalName: s.originalName,
          firstAirYear: s.firstAirYear,
          posterPath: s.posterPath,
          overview: s.overview,
          originalLanguage: s.originalLanguage,
          isEnglishAudio: s.isEnglishAudio,
        })),
        totalResults: matched.length,
        totalPages: 1,
      };
    }

    try {
      const url = `${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&page=${page}&language=pt-BR&include_adult=false`;
      const res = await fetchJson<TmdbSearchTvResponse>(url, { headers: this.getHeaders() });
      return {
        results: res.results.map(mapSearchResult),
        totalResults: res.total_results,
        totalPages: res.total_pages,
      };
    } catch (err) {
      logger.error('TMDB search series failed', { query }, err);
      throw err;
    }
  }

  async getSeriesDetails(seriesId: number): Promise<SeriesDetails> {
    if (env.MOCK_UPSTREAMS) {
      const found = MOCK_SERIES.find((s) => s.id === seriesId);
      if (found) return found;
      return MOCK_SERIES[0];
    }

    try {
      const url = `${TMDB_BASE_URL}/tv/${seriesId}?language=pt-BR&append_to_response=external_ids`;
      const res = await fetchJson<TmdbTvDetails>(url, { headers: this.getHeaders() });
      return mapSeriesDetails(res);
    } catch (err) {
      logger.error('TMDB getSeriesDetails failed', { seriesId }, err);
      throw err;
    }
  }

  async getSeasonDetails(seriesId: number, seasonNumber: number): Promise<SeasonDetails> {
    if (env.MOCK_UPSTREAMS) {
      const key = `${seriesId}-${seasonNumber}`;
      if (MOCK_EPISODES[key]) return MOCK_EPISODES[key];
      return MOCK_EPISODES['31586-1'];
    }

    try {
      const urlPt = `${TMDB_BASE_URL}/tv/${seriesId}/season/${seasonNumber}?language=pt-BR`;
      const urlEn = `${TMDB_BASE_URL}/tv/${seriesId}/season/${seasonNumber}?language=en-US`;

      const [resPt, resEn] = await Promise.all([
        fetchJson<TmdbSeasonDetails>(urlPt, { headers: this.getHeaders() }),
        fetchJson<TmdbSeasonDetails>(urlEn, { headers: this.getHeaders() }).catch(() => undefined),
      ]);

      return mapSeasonDetails(seriesId, resPt, resEn);
    } catch (err) {
      logger.error('TMDB getSeasonDetails failed', { seriesId, seasonNumber }, err);
      throw err;
    }
  }

  async getEpisodeDetailsEn(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<{ name: string; runtime: number; imdbId?: string | null }> {
    if (env.MOCK_UPSTREAMS) {
      return {
        name: 'Pilot',
        runtime: 24,
        imdbId: 'tt1604099',
      };
    }

    try {
      const url = `${TMDB_BASE_URL}/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}?language=en-US&append_to_response=external_ids`;
      const res = await fetchJson<TmdbEpisodeInfo & { external_ids?: { imdb_id?: string | null } }>(url, {
        headers: this.getHeaders(),
      });
      return {
        name: res.name,
        runtime: res.runtime ?? 22,
        imdbId: res.external_ids?.imdb_id ?? null,
      };
    } catch (err) {
      logger.warn('TMDB getEpisodeDetailsEn fallback', { seriesId, seasonNumber, episodeNumber }, err);
      return { name: `Episode ${episodeNumber}`, runtime: 22 };
    }
  }
}

export const tmdbClient = new TmdbClient();
