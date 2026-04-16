CREATE TABLE IF NOT EXISTS "session_canon_baselines" (
  "session_id" text PRIMARY KEY REFERENCES "story_sessions"("id") ON DELETE CASCADE,
  "world_id" text NOT NULL REFERENCES "story_worlds"("id") ON DELETE CASCADE,
  "reader_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_chapter_id" text REFERENCES "story_turns"("id") ON DELETE SET NULL,
  "source_chapter_number" integer NOT NULL,
  "chapter_one_summary" text,
  "lead_character_names" text NOT NULL DEFAULT '[]',
  "notable_place_names" text NOT NULL DEFAULT '[]',
  "canonical_facts" text NOT NULL DEFAULT '[]',
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_canon_baselines_world_reader_idx"
  ON "session_canon_baselines" USING btree ("world_id", "reader_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_canon_baselines_updated_idx"
  ON "session_canon_baselines" USING btree ("updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_chapter_snapshots" (
  "id" text PRIMARY KEY,
  "session_id" text NOT NULL REFERENCES "story_sessions"("id") ON DELETE CASCADE,
  "chapter_id" text NOT NULL REFERENCES "story_turns"("id") ON DELETE CASCADE,
  "chapter_number" integer NOT NULL,
  "chapter_title" text NOT NULL,
  "opening_state" text,
  "ending_state" text,
  "active_character_names" text NOT NULL DEFAULT '[]',
  "active_place_names" text NOT NULL DEFAULT '[]',
  "unresolved_threads" text NOT NULL DEFAULT '[]',
  "major_events" text NOT NULL DEFAULT '[]',
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "session_chapter_snapshots_session_chapter_uidx" UNIQUE("session_id", "chapter_number"),
  CONSTRAINT "session_chapter_snapshots_chapter_uidx" UNIQUE("chapter_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_chapter_snapshots_session_updated_idx"
  ON "session_chapter_snapshots" USING btree ("session_id", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_event_ledger" (
  "id" text PRIMARY KEY,
  "session_id" text NOT NULL REFERENCES "story_sessions"("id") ON DELETE CASCADE,
  "chapter_id" text NOT NULL REFERENCES "story_turns"("id") ON DELETE CASCADE,
  "chapter_number" integer NOT NULL,
  "event_kind" text NOT NULL DEFAULT 'EVENT'
    CHECK ("event_kind" IN ('EVENT', 'REVEAL', 'COMMITMENT', 'STATE_CHANGE', 'CLIFFHANGER')),
  "summary" text NOT NULL,
  "subject_key" text,
  "importance" integer NOT NULL DEFAULT 1
    CHECK ("importance" BETWEEN 1 AND 5),
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_event_ledger_session_chapter_idx"
  ON "session_event_ledger" USING btree ("session_id", "chapter_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_event_ledger_session_importance_idx"
  ON "session_event_ledger" USING btree ("session_id", "importance");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_event_ledger_chapter_idx"
  ON "session_event_ledger" USING btree ("chapter_id");
