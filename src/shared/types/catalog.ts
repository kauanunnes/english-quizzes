import { z } from 'zod';

export const SeriesSearchResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  originalName: z.string(),
  firstAirYear: z.string().nullable(),
  posterPath: z.string().nullable(),
  overview: z.string(),
  originalLanguage: z.string(),
  isEnglishAudio: z.boolean(),
});
export type SeriesSearchResult = z.infer<typeof SeriesSearchResultSchema>;

export const SeasonSummarySchema = z.object({
  seasonNumber: z.number(),
  name: z.string(),
  episodeCount: z.number(),
  airDate: z.string().nullable(),
  posterPath: z.string().nullable(),
});
export type SeasonSummary = z.infer<typeof SeasonSummarySchema>;

export const SeriesDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  originalName: z.string(),
  overview: z.string(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  firstAirYear: z.string().nullable(),
  lastAirYear: z.string().nullable(),
  numberOfSeasons: z.number(),
  originalLanguage: z.string(),
  isEnglishAudio: z.boolean(),
  seasons: z.array(SeasonSummarySchema),
  imdbId: z.string().nullable().optional(),
});
export type SeriesDetails = z.infer<typeof SeriesDetailsSchema>;

export const EpisodeQuizStatusSchema = z.enum([
  'ready',
  'generating',
  'no_quiz',
  'no_subtitle',
]);
export type EpisodeQuizStatus = z.infer<typeof EpisodeQuizStatusSchema>;

export const EpisodeSummarySchema = z.object({
  id: z.number(),
  episodeNumber: z.number(),
  seasonNumber: z.number(),
  name: z.string(),
  nameLang: z.enum(['pt', 'en']).default('pt'),
  overview: z.string(),
  overviewLang: z.enum(['pt', 'en']).default('pt'),
  stillPath: z.string().nullable(),
  runtimeMinutes: z.number(),
  airDate: z.string().nullable(),
  quizStatus: EpisodeQuizStatusSchema.default('no_quiz'),
  activeJobId: z.string().nullable().optional(),
});
export type EpisodeSummary = z.infer<typeof EpisodeSummarySchema>;

export const SeasonDetailsSchema = z.object({
  seriesId: z.number(),
  seasonNumber: z.number(),
  name: z.string(),
  overview: z.string(),
  posterPath: z.string().nullable(),
  episodes: z.array(EpisodeSummarySchema),
});
export type SeasonDetails = z.infer<typeof SeasonDetailsSchema>;
