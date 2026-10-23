CREATE TABLE "episodes" (
	"episode_key" text PRIMARY KEY NOT NULL,
	"series_id" integer NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"title" text NOT NULL,
	"runtime_minutes" integer DEFAULT 22 NOT NULL,
	"imdb_id" text,
	"tmdb_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_key" text NOT NULL,
	"status" text NOT NULL,
	"stage" text NOT NULL,
	"progress" jsonb NOT NULL,
	"error" jsonb,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_key" text NOT NULL,
	"series_id" integer NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"document" jsonb NOT NULL,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quizzes_episode_key_unique" UNIQUE("episode_key")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtitle_selections" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_key" text NOT NULL,
	"strategy" text NOT NULL,
	"file_id" integer,
	"file_name" text,
	"release_name" text,
	"sha256" text,
	"score" real,
	"candidates" jsonb,
	"accepted" boolean DEFAULT true NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"date" text PRIMARY KEY NOT NULL,
	"llm_cost_usd" real DEFAULT 0 NOT NULL,
	"subtitles_downloaded" integer DEFAULT 0 NOT NULL,
	"quizzes_generated" integer DEFAULT 0 NOT NULL
);
