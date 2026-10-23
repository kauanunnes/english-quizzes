import { pgTable, text, integer, timestamp, jsonb, boolean, real } from 'drizzle-orm/pg-core';
import type { QuizDocument } from '@shared/types/quiz';
import type { JobError, JobProgress, JobStatus } from '@shared/types/job';

export const quizzes = pgTable('quizzes', {
  id: text('id').primaryKey(),
  episodeKey: text('episode_key').notNull().unique(),
  seriesId: integer('series_id').notNull(),
  seasonNumber: integer('season_number').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  document: jsonb('document').$type<QuizDocument>().notNull(),
  usage: jsonb('usage').$type<QuizDocument['usage']>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const generationJobs = pgTable('generation_jobs', {
  id: text('id').primaryKey(),
  episodeKey: text('episode_key').notNull(),
  status: text('status').$type<JobStatus>().notNull(),
  stage: text('stage').notNull(),
  progress: jsonb('progress').$type<JobProgress>().notNull(),
  error: jsonb('error').$type<JobError>(),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const subtitleSelections = pgTable('subtitle_selections', {
  id: text('id').primaryKey(),
  episodeKey: text('episode_key').notNull(),
  strategy: text('strategy').notNull(),
  fileId: integer('file_id'),
  fileName: text('file_name'),
  releaseName: text('release_name'),
  sha256: text('sha256'),
  score: real('score'),
  candidates: jsonb('candidates'),
  accepted: boolean('accepted').default(true).notNull(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rateLimitCounters = pgTable('rate_limit_counters', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(1),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const providerState = pgTable('provider_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usageDaily = pgTable('usage_daily', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  llmCostUsd: real('llm_cost_usd').default(0).notNull(),
  subtitlesDownloaded: integer('subtitles_downloaded').default(0).notNull(),
  quizzesGenerated: integer('quizzes_generated').default(0).notNull(),
});

export const episodes = pgTable('episodes', {
  episodeKey: text('episode_key').primaryKey(),
  seriesId: integer('series_id').notNull(),
  seasonNumber: integer('season_number').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').notNull(),
  runtimeMinutes: integer('runtime_minutes').notNull().default(22),
  imdbId: text('imdb_id'),
  tmdbSyncedAt: timestamp('tmdb_synced_at', { withTimezone: true }).defaultNow().notNull(),
});
