import { z } from 'zod';

export const JobStatusSchema = z.enum([
  'queued',
  'resolving',
  'searching',
  'downloading',
  'parsing',
  'generating',
  'validating',
  'ready',
  'failed',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobErrorCodeSchema = z.enum([
  'SUBTITLE_NOT_FOUND',
  'SUBTITLE_QUOTA_EXCEEDED',
  'SUBTITLE_UNUSABLE',
  'LLM_FAILED',
  'BUDGET_EXCEEDED',
  'QUALITY_CHECK_FAILED',
  'JOB_STALLED',
  'UPSTREAM_AUTH_FAILED',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'INTERNAL_ERROR',
]);
export type JobErrorCode = z.infer<typeof JobErrorCodeSchema>;

export const JobProgressSchema = z.object({
  currentSegment: z.number().optional(),
  totalSegments: z.number().optional(),
  percentage: z.number().min(0).max(100),
  message: z.string(),
});
export type JobProgress = z.infer<typeof JobProgressSchema>;

export const JobErrorSchema = z.object({
  code: JobErrorCodeSchema,
  message: z.string(),
  action: z.string().optional(),
  resetAt: z.string().optional(),
});
export type JobError = z.infer<typeof JobErrorSchema>;

export const GenerationJobSchema = z.object({
  id: z.string(),
  episodeKey: z.string(),
  status: JobStatusSchema,
  stage: z.string(),
  progress: JobProgressSchema,
  error: JobErrorSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  heartbeatAt: z.string(),
  finishedAt: z.string().nullable().optional(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
