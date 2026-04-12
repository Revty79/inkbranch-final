CREATE TABLE IF NOT EXISTS "story_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"reader_id" text NOT NULL,
	"spine_version_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"turn_index" integer NOT NULL,
	"reader_input" text NOT NULL,
	"ai_response" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'story_sessions_world_id_story_worlds_id_fk'
	) THEN
		ALTER TABLE "story_sessions"
		ADD CONSTRAINT "story_sessions_world_id_story_worlds_id_fk"
		FOREIGN KEY ("world_id") REFERENCES "public"."story_worlds"("id")
		ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'story_sessions_reader_id_users_id_fk'
	) THEN
		ALTER TABLE "story_sessions"
		ADD CONSTRAINT "story_sessions_reader_id_users_id_fk"
		FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id")
		ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'story_sessions_spine_version_id_world_spine_versions_id_fk'
	) THEN
		ALTER TABLE "story_sessions"
		ADD CONSTRAINT "story_sessions_spine_version_id_world_spine_versions_id_fk"
		FOREIGN KEY ("spine_version_id") REFERENCES "public"."world_spine_versions"("id")
		ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'story_turns_session_id_story_sessions_id_fk'
	) THEN
		ALTER TABLE "story_turns"
		ADD CONSTRAINT "story_turns_session_id_story_sessions_id_fk"
		FOREIGN KEY ("session_id") REFERENCES "public"."story_sessions"("id")
		ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_sessions_reader_status_idx"
	ON "story_sessions" USING btree ("reader_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_sessions_world_reader_idx"
	ON "story_sessions" USING btree ("world_id","reader_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "story_turns_session_turn_uidx"
	ON "story_turns" USING btree ("session_id","turn_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_turns_session_idx"
	ON "story_turns" USING btree ("session_id");
