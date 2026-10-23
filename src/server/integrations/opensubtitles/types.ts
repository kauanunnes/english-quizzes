export interface OsSubtitleAttributes {
  subtitle_id: string;
  language: string;
  download_count: number;
  ratings: number;
  votes: number;
  hearing_impaired: boolean;
  ai_translated: boolean;
  machine_translated: boolean;
  foreign_parts_only: boolean;
  upload_date: string;
  release?: string;
  comments?: string;
  from_trusted?: boolean;
  url?: string;
  files: Array<{
    file_id: number;
    cd_number: number;
    file_name: string;
  }>;
  feature_details?: {
    feature_id?: number;
    feature_type?: string;
    year?: number;
    title?: string;
    parent_title?: string;
    season_number?: number;
    episode_number?: number;
    imdb_id?: number;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
  };
}

export interface OsSubtitleItem {
  id: string;
  type: string;
  attributes: OsSubtitleAttributes;
}

export interface OsSearchResponse {
  total_pages: number;
  total_count: number;
  per_page: number;
  page: number;
  data: OsSubtitleItem[];
}

export interface OsDownloadResponse {
  link: string;
  file_name: string;
  requests: number;
  remaining: number;
  message: string;
  reset_time: string;
  reset_time_utc: string;
}
