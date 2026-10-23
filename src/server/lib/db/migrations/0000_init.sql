CREATE TABLE "episodes" (
	"episode_key" text PRIMARY KEY NOT NULL,
	"tmdb_series_id" integer NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"tmdb_episode_id" integer,
	"imdb_episode_id" text,
	"imdb_series_id" text,
	"series_name" text,
	"episode_name_en" text,
	"episode_name_pt" text,
	"runtime_min" integer,
	"air_date" date,
	"original_language" text,
	"tmdb_synced_at" timestamp with time zone,
	"subtitle_status" text DEFAULT 'unknown' NOT NULL,
	"subtitle_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"segments_done" integer DEFAULT 0 NOT NULL,
	"segments_total" integer,
	"source" text NOT NULL,
	"error_code" text,
	"error_detail" text,
	"quiz_id" uuid,
	"device_hash" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"deadline_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pregen_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_key" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"reason" text NOT NULL,
	"comment" text,
	"device_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_key" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"schema_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"effort" text,
	"source" text NOT NULL,
	"subtitle_selection_id" uuid,
	"segment_count" integer NOT NULL,
	"question_count" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"usage" jsonb NOT NULL,
	"quality" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_counters_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
CREATE TABLE "subtitle_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_key" text NOT NULL,
	"job_id" uuid,
	"provider" text NOT NULL,
	"strategy" text NOT NULL,
	"provider_subtitle_id" text,
	"provider_file_id" text,
	"release" text,
	"language" text DEFAULT 'en' NOT NULL,
	"hearing_impaired" boolean,
	"from_trusted" boolean,
	"download_count" integer,
	"ratings" real,
	"votes" integer,
	"upload_date" timestamp with time zone,
	"score" real,
	"candidates" jsonb,
	"file_sha256" text,
	"file_bytes" integer,
	"encoding" text,
	"format" text,
	"parser_stats" jsonb,
	"qa" jsonb,
	"accepted" boolean NOT NULL,
	"rejection_reason" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"day" date PRIMARY KEY NOT NULL,
	"generations_started" integer DEFAULT 0 NOT NULL,
	"generations_ready" integer DEFAULT 0 NOT NULL,
	"generations_failed" integer DEFAULT 0 NOT NULL,
	"subtitle_downloads" integer DEFAULT 0 NOT NULL,
	"llm_calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_read_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_write_tokens" bigint DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_episode_key_episodes_episode_key_fk" FOREIGN KEY ("episode_key") REFERENCES "public"."episodes"("episode_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_episode_key_episodes_episode_key_fk" FOREIGN KEY ("episode_key") REFERENCES "public"."episodes"("episode_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_subtitle_selection_id_subtitle_selections_id_fk" FOREIGN KEY ("subtitle_selection_id") REFERENCES "public"."subtitle_selections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_selections" ADD CONSTRAINT "subtitle_selections_episode_key_episodes_episode_key_fk" FOREIGN KEY ("episode_key") REFERENCES "public"."episodes"("episode_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episodes_series_season_idx" ON "episodes" USING btree ("tmdb_series_id","season_number");--> statement-breakpoint
CREATE INDEX "episodes_tmdb_synced_idx" ON "episodes" USING btree ("tmdb_synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_active_episode_uq" ON "generation_jobs" USING btree ("episode_key") WHERE status in ('queued','running');--> statement-breakpoint
CREATE INDEX "jobs_status_created_idx" ON "generation_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pregen_pending_uq" ON "pregen_queue" USING btree ("episode_key") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "reports_quiz_idx" ON "question_reports" USING btree ("quiz_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_episode_version_uq" ON "quizzes" USING btree ("episode_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_ready_episode_uq" ON "quizzes" USING btree ("episode_key") WHERE status = 'ready';--> statement-breakpoint
CREATE INDEX "rl_expires_idx" ON "rate_limit_counters" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subsel_episode_time_idx" ON "subtitle_selections" USING btree ("episode_key","downloaded_at");