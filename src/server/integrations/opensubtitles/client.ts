import * as zlib from 'node:zlib';
import { env } from '@server/env';
import { fetchJson, fetchWithTimeout, HttpError, isRetryableError, retryAfterOf } from '@server/lib/http';
import { logger } from '@server/lib/logger';
import { withRetry } from '@server/lib/retry';
import { buildSubtitleQuery } from './query';
import { scoreCandidate, filterCandidate } from './selection';
import { calculateTitleSimilarity } from './titleMatch';
import { OsSearchResponse, OsDownloadResponse, OsSubtitleItem, OsLoginResponse } from './types';

const OS_BASE_URL = 'https://api.opensubtitles.com/api/v1';

// docs/03 §3.6
const LOGIN_TIMEOUT_MS = 10_000;
const SEARCH_TIMEOUT_MS = 8_000;
const DOWNLOAD_REQUEST_TIMEOUT_MS = 10_000;
const FILE_TIMEOUT_MS = 15_000;
// §4.2.3: validade do token não documentada; reaproveitar token + host por 12 h
const SESSION_TTL_MS = 12 * 3600 * 1000;
// §4.2.5 (V1)
const TITLE_SIMILARITY_MIN = 0.8;

// Nomes iguais ao enum de subtitle_selections.strategy (docs/05 §5.3)
export type SubtitleStrategy = 'parent_tmdb' | 'imdb_episode' | 'tmdb_episode' | 'parent_imdb' | 'query';

let session: { token: string; baseUrl: string; expiresAt: number } | null = null;

export interface FindSubtitleParams {
  seriesId: number;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitleEn: string;
  seriesImdbId?: string | null;
  episodeImdbId?: string | null;
}

export interface CandidateResult {
  item: OsSubtitleItem;
  score: number;
  strategy: SubtitleStrategy;
}

export interface DownloadedSubtitle {
  bytes: Uint8Array;
  fileName: string | null;
  remaining: number | null;
  resetTimeUtc: string | null;
}

// login devolve só o host (ex.: "vip-api.opensubtitles.com")
function apiBaseFromHost(baseUrl: string | undefined): string {
  if (!baseUrl) return OS_BASE_URL;
  const host = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return host ? `https://${host}/api/v1` : OS_BASE_URL;
}

export class OpenSubtitlesClient {
  private apiKey: string;
  private userAgent: string;

  constructor() {
    this.apiKey = env.OPENSUBTITLES_API_KEY || '';
    this.userAgent = env.OPENSUBTITLES_USER_AGENT;
  }

  // OS_MODE=mock (padrão local e no preview, §13.4) não gasta a cota da conta
  private get useMock(): boolean {
    return env.MOCK_UPSTREAMS || env.OS_MODE === 'mock';
  }

  private baseHeaders(): Record<string, string> {
    return { 'Api-Key': this.apiKey, 'User-Agent': this.userAgent };
  }

  private async getSession(): Promise<{ token: string; baseUrl: string }> {
    if (session && Date.now() < session.expiresAt) return session;

    // §4.2.9: login tem limite próprio (~1/s); no máximo 1 nova tentativa
    const res = await withRetry(
      () =>
        fetchJson<OsLoginResponse>(`${OS_BASE_URL}/login`, {
          method: 'POST',
          headers: { ...this.baseHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: env.OPENSUBTITLES_USERNAME, password: env.OPENSUBTITLES_PASSWORD }),
          timeoutMs: LOGIN_TIMEOUT_MS,
        }),
      { retries: 1, baseMs: 1000, maxMs: 2000, shouldRetry: isRetryableError, retryAfterMs: retryAfterOf }
    );

    session = { token: res.token, baseUrl: apiBaseFromHost(res.base_url), expiresAt: Date.now() + SESSION_TTL_MS };
    return session;
  }

  async searchSubtitles(queryString: string): Promise<OsSubtitleItem[]> {
    const res = await withRetry(
      () =>
        fetchJson<OsSearchResponse>(`${OS_BASE_URL}/subtitles?${queryString}`, {
          headers: this.baseHeaders(),
          timeoutMs: SEARCH_TIMEOUT_MS,
        }),
      { retries: 2, baseMs: 500, maxMs: 1500, shouldRetry: isRetryableError, retryAfterMs: retryAfterOf }
    );
    return res.data || [];
  }

  async findBestCandidates(params: FindSubtitleParams): Promise<{ candidates: CandidateResult[]; strategy: SubtitleStrategy | null }> {
    if (this.useMock) {
      logger.info('OpenSubtitles in mock mode, returning synthetic candidate');
      return {
        candidates: [
          {
            item: {
              id: 'mock-sub-1',
              type: 'subtitle',
              attributes: {
                subtitle_id: 'mock-1',
                language: 'en',
                download_count: 5000,
                ratings: 9.5,
                votes: 50,
                hearing_impaired: false,
                ai_translated: false,
                machine_translated: false,
                foreign_parts_only: false,
                upload_date: new Date().toISOString(),
                release: 'WEB-DL.Amazon',
                files: [{ file_id: 999999, cd_number: 1, file_name: 'episode.en.srt' }],
                feature_details: {
                  title: params.episodeTitleEn,
                  parent_title: params.seriesTitle,
                  season_number: params.seasonNumber,
                  episode_number: params.episodeNumber,
                },
              },
            },
            score: 100,
            strategy: 'parent_tmdb',
          },
        ],
        strategy: 'parent_tmdb',
      };
    }

    // Cadeia de §4.2.5 (a E3 e a validação completa V1/V2 entram na Fase 3)
    const strategies: { name: SubtitleStrategy; query: string; requiresTitleValidation: boolean }[] = [
      {
        name: 'parent_tmdb',
        query: buildSubtitleQuery({
          ai_translated: 'exclude',
          episode_number: params.episodeNumber,
          foreign_parts_only: 'exclude',
          languages: 'en',
          parent_tmdb_id: params.seriesId,
          season_number: params.seasonNumber,
        }),
        requiresTitleValidation: true,
      },
      ...(params.episodeImdbId
        ? [
            {
              name: 'imdb_episode' as const,
              query: buildSubtitleQuery({
                ai_translated: 'exclude',
                foreign_parts_only: 'exclude',
                imdb_id: params.episodeImdbId,
                languages: 'en',
              }),
              requiresTitleValidation: false,
            },
          ]
        : []),
      ...(params.seriesImdbId
        ? [
            {
              name: 'parent_imdb' as const,
              query: buildSubtitleQuery({
                ai_translated: 'exclude',
                episode_number: params.episodeNumber,
                foreign_parts_only: 'exclude',
                languages: 'en',
                parent_imdb_id: params.seriesImdbId,
                season_number: params.seasonNumber,
              }),
              requiresTitleValidation: true,
            },
          ]
        : []),
      {
        name: 'query',
        query: buildSubtitleQuery({
          ai_translated: 'exclude',
          episode_number: params.episodeNumber,
          foreign_parts_only: 'exclude',
          languages: 'en',
          query: params.seriesTitle,
          season_number: params.seasonNumber,
          type: 'episode',
        }),
        requiresTitleValidation: true,
      },
    ];

    for (const strat of strategies) {
      const items = await this.searchSubtitles(strat.query);
      if (items.length === 0) continue;

      const filtered = items.filter((item) => {
        const attr = item.attributes;
        if (!filterCandidate(attr)) return false;

        if (strat.requiresTitleValidation && params.episodeTitleEn && attr.feature_details?.title) {
          return calculateTitleSimilarity(attr.feature_details.title, params.episodeTitleEn) >= TITLE_SIMILARITY_MIN;
        }
        return true;
      });

      if (filtered.length > 0) {
        const scored = filtered.map((item) => ({ item, score: scoreCandidate(item.attributes), strategy: strat.name }));
        scored.sort((a, b) => b.score - a.score);
        return { candidates: scored, strategy: strat.name };
      }
    }

    return { candidates: [], strategy: null };
  }

  // §4.2.8: consome 1 download da cota; os bytes seguem só em memória (ADR-009)
  async downloadSubtitle(fileId: number): Promise<DownloadedSubtitle> {
    if (this.useMock) {
      return { bytes: new TextEncoder().encode(buildMockSrt()), fileName: 'episode.en.srt', remaining: null, resetTimeUtc: null };
    }

    const { token, baseUrl } = await this.getSession();
    // Timeout no POST /download não é repetido: o download pode ter sido contado (§4.2.9)
    const download = await withRetry(
      () =>
        fetchJson<OsDownloadResponse>(`${baseUrl}/download`, {
          method: 'POST',
          headers: { ...this.baseHeaders(), 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file_id: fileId, sub_format: 'srt' }),
          timeoutMs: DOWNLOAD_REQUEST_TIMEOUT_MS,
        }),
      { retries: 1, baseMs: 500, maxMs: 1500, shouldRetry: (e) => e instanceof HttpError && e.status >= 500 }
    );

    const raw = await withRetry(
      async () => {
        const res = await fetchWithTimeout(download.link, { timeoutMs: FILE_TIMEOUT_MS });
        if (!res.ok) throw new HttpError(res.status, res.statusText);
        return new Uint8Array(await res.arrayBuffer());
      },
      { retries: 1, baseMs: 500, maxMs: 1500, shouldRetry: isRetryableError }
    );

    // gzip (1F 8B) é descompactado aqui; o resto do pipeline recebe só bytes de texto
    const bytes = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b ? new Uint8Array(zlib.gunzipSync(raw)) : raw;

    return {
      bytes,
      fileName: download.file_name ?? null,
      remaining: typeof download.remaining === 'number' ? download.remaining : null,
      resetTimeUtc: download.reset_time_utc ?? null,
    };
  }
}

// SRT sintético para o modo mock: falas inventadas, ~20 min, com rótulos, música e descrições sonoras
function buildMockSrt(): string {
  const characters = ['TORI', 'ANDRE', 'JADE', 'BECK', 'CAT', 'ROBBIE', 'TRINA'];
  const phrases = [
    'Hey guys, check out this brand new performance!',
    'The acoustic rhythm on this track is absolutely amazing.',
    "Don't get ahead of yourself, you still have to pass the showcase.",
    'Jade, relax. She has genuine talent and you know it.',
    'Guess what! My brother just made a rocket out of cardboard!',
    "Cat, that doesn't sound safe at all.",
    'I am the most talented student in this entire academy!',
    'Why does everyone always doubt my artistic vision?',
    'We should really rehearse the final scene before Sikowitz arrives.',
    'Did someone say coconut milk? Because I could really use one.',
  ];
  const time = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},000`;
  };

  const cues: string[] = [];
  for (let i = 0; i < 180; i++) {
    const start = i * 6.5;
    let text = `${characters[i % characters.length]}: ${phrases[i % phrases.length]}`;
    if (i % 25 === 0) text = '♪ Make it shine ♪';
    else if (i % 17 === 0) text = `[laughs] ${phrases[i % phrases.length]}`;
    cues.push(`${i + 1}\n${time(start)} --> ${time(start + 4.5)}\n${text}\n`);
  }
  return cues.join('\n');
}

export const openSubtitlesClient = new OpenSubtitlesClient();
