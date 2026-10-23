export interface TmdbTvSearchResult {
  id: number;
  name: string;
  original_name: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  original_language: string;
}

export interface TmdbSearchTvResponse {
  page: number;
  results: TmdbTvSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TmdbSeasonInfo {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date?: string | null;
  poster_path?: string | null;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  last_air_date?: string | null;
  number_of_seasons: number;
  original_language: string;
  seasons: TmdbSeasonInfo[];
  external_ids?: {
    imdb_id?: string | null;
    tvdb_id?: number | null;
  };
}

export interface TmdbEpisodeInfo {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path?: string | null;
  runtime?: number | null;
  air_date?: string | null;
}

export interface TmdbSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path?: string | null;
  episodes: TmdbEpisodeInfo[];
}
