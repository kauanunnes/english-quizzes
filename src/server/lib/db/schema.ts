// docs/05 §5.3 — schema do servidor (Drizzle)
import { sql } from 'drizzle-orm';
import {
  pgTable, text, integer, boolean, real, jsonb, timestamp, date, uuid,
  numeric, bigint, primaryKey, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { QuizDocument, QuizUsage, QuizQuality } from '@shared/types/quiz';
import type { CandidateSummary, ParserStats, QaResult } from '@shared/types/subtitles';
import { JOB_STAGES } from '@shared/types/generation';

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const episodes = pgTable('episodes', {
  episodeKey: text('episode_key').primaryKey(),               // tmdb-1234-s01-e04
  tmdbSeriesId: integer('tmdb_series_id').notNull(),
  seasonNumber: integer('season_number').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  tmdbEpisodeId: integer('tmdb_episode_id'),
  imdbEpisodeId: text('imdb_episode_id'),                     // 'tt0000000'
  imdbSeriesId: text('imdb_series_id'),
  // Metadados da TMDB: renovar antes de 150 dias; anular aos 170 sem renovação
  seriesName: text('series_name'),
  episodeNameEn: text('episode_name_en'),
  episodeNamePt: text('episode_name_pt'),
  runtimeMin: integer('runtime_min'),
  airDate: date('air_date'),
  originalLanguage: text('original_language'),
  tmdbSyncedAt: ts('tmdb_synced_at'),
  // Resultado da última busca de legenda
  subtitleStatus: text('subtitle_status', {
    enum: ['unknown', 'found', 'not_found', 'numbering_mismatch'],
  }).notNull().default('unknown'),
  subtitleCheckedAt: ts('subtitle_checked_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  index('episodes_series_season_idx').on(t.tmdbSeriesId, t.seasonNumber),
  index('episodes_tmdb_synced_idx').on(t.tmdbSyncedAt),
]);

export const subtitleSelections = pgTable('subtitle_selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  episodeKey: text('episode_key').notNull().references(() => episodes.episodeKey),
  jobId: uuid('job_id'),
  provider: text('provider', { enum: ['opensubtitles', 'upload', 'subdl'] }).notNull(),
  strategy: text('strategy', {
    enum: ['parent_tmdb', 'imdb_episode', 'tmdb_episode', 'parent_imdb', 'query', 'upload'],
  }).notNull(),
  providerSubtitleId: text('provider_subtitle_id'),
  providerFileId: text('provider_file_id'),
  release: text('release'),
  language: text('language').notNull().default('en'),
  hearingImpaired: boolean('hearing_impaired'),
  fromTrusted: boolean('from_trusted'),
  downloadCount: integer('download_count'),
  ratings: real('ratings'),
  votes: integer('votes'),
  uploadDate: ts('upload_date'),
  score: real('score'),
  candidates: jsonb('candidates').$type<CandidateSummary[]>(), // top 5, só metadados
  fileSha256: text('file_sha256'),                              // hash, nunca conteúdo
  fileBytes: integer('file_bytes'),
  encoding: text('encoding'),
  format: text('format', { enum: ['srt', 'vtt'] }),
  parserStats: jsonb('parser_stats').$type<ParserStats>(),
  qa: jsonb('qa').$type<QaResult>(),
  accepted: boolean('accepted').notNull(),
  rejectionReason: text('rejection_reason'),
  downloadedAt: ts('downloaded_at').notNull().defaultNow(),
}, (t) => [index('subsel_episode_time_idx').on(t.episodeKey, t.downloadedAt)]);

export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  episodeKey: text('episode_key').notNull().references(() => episodes.episodeKey),
  version: integer('version').notNull(),
  status: text('status', { enum: ['ready', 'superseded', 'withdrawn'] }).notNull().default('ready'),
  schemaVersion: text('schema_version').notNull(),              // '1.0'
  promptVersion: text('prompt_version').notNull(),              // 'quiz-2026-10-v1'
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  effort: text('effort'),
  source: text('source', { enum: ['opensubtitles', 'upload', 'subdl'] }).notNull(),
  subtitleSelectionId: uuid('subtitle_selection_id').references(() => subtitleSelections.id),
  segmentCount: integer('segment_count').notNull(),
  questionCount: integer('question_count').notNull(),
  payload: jsonb('payload').$type<QuizDocument>().notNull(),
  usage: jsonb('usage').$type<QuizUsage>().notNull(),
  quality: jsonb('quality').$type<QuizQuality>().notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('quizzes_episode_version_uq').on(t.episodeKey, t.version),
  uniqueIndex('quizzes_ready_episode_uq').on(t.episodeKey).where(sql`status = 'ready'`),
]);

export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  episodeKey: text('episode_key').notNull().references(() => episodes.episodeKey),
  status: text('status', { enum: ['queued', 'running', 'ready', 'failed'] }).notNull().default('queued'),
  stage: text('stage', { enum: JOB_STAGES }).notNull().default('queued'),
  progress: integer('progress').notNull().default(0),
  segmentsDone: integer('segments_done').notNull().default(0),
  segmentsTotal: integer('segments_total'),
  source: text('source', { enum: ['interactive', 'pregen', 'upload'] }).notNull(),
  errorCode: text('error_code'),
  errorDetail: text('error_detail'),                            // sanitizado: nunca texto de legenda
  quizId: uuid('quiz_id'),
  deviceHash: text('device_hash'),
  ipHash: text('ip_hash'),
  createdAt: ts('created_at').notNull().defaultNow(),
  startedAt: ts('started_at'),
  heartbeatAt: ts('heartbeat_at'),
  finishedAt: ts('finished_at'),
  deadlineAt: ts('deadline_at').notNull(),
}, (t) => [
  uniqueIndex('jobs_active_episode_uq').on(t.episodeKey).where(sql`status in ('queued','running')`),
  index('jobs_status_created_idx').on(t.status, t.createdAt),
]);

export const rateLimitCounters = pgTable('rate_limit_counters', {
  bucket: text('bucket').notNull(),                             // 'gen:ip:<hash>'
  windowStart: ts('window_start').notNull(),
  count: integer('count').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.bucket, t.windowStart] }),
  index('rl_expires_idx').on(t.expiresAt),
]);

export const usageDaily = pgTable('usage_daily', {
  day: date('day').primaryKey(),                                // dia em UTC
  generationsStarted: integer('generations_started').notNull().default(0),
  generationsReady: integer('generations_ready').notNull().default(0),
  generationsFailed: integer('generations_failed').notNull().default(0),
  subtitleDownloads: integer('subtitle_downloads').notNull().default(0),
  llmCalls: integer('llm_calls').notNull().default(0),
  inputTokens: bigint('input_tokens', { mode: 'number' }).notNull().default(0),
  outputTokens: bigint('output_tokens', { mode: 'number' }).notNull().default(0),
  cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }).notNull().default(0),
  cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }).notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 10, scale: 4 }).notNull().default('0'),
});

export const providerState = pgTable('provider_state', {
  key: text('key').primaryKey(),        // 'opensubtitles.session' | 'opensubtitles.quota'
  value: jsonb('value').notNull(),      // sessão: { iv, ciphertext, tag } (AES-256-GCM)
  expiresAt: ts('expires_at'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const questionReports = pgTable('question_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id),
  questionId: text('question_id').notNull(),
  reason: text('reason', { enum: ['wrong_answer', 'visual', 'spoiler', 'confusing', 'other'] }).notNull(),
  comment: text('comment'),                                     // opcional, ≤ 280 caracteres
  deviceHash: text('device_hash'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('reports_quiz_idx').on(t.quizId)]);

export const pregenQueue = pgTable('pregen_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  episodeKey: text('episode_key').notNull(),
  priority: integer('priority').notNull().default(100),
  status: text('status', { enum: ['pending', 'done', 'skipped', 'failed'] }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: ts('created_at').notNull().defaultNow(),
  processedAt: ts('processed_at'),
}, (t) => [uniqueIndex('pregen_pending_uq').on(t.episodeKey).where(sql`status = 'pending'`)]);
