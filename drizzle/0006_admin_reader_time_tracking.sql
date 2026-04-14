ALTER TABLE "story_sessions" ADD COLUMN IF NOT EXISTS "reading_seconds" integer NOT NULL DEFAULT 0;
