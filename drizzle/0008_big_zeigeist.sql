ALTER TABLE "story_worlds"
  ADD COLUMN IF NOT EXISTS "genre" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_worlds_genre_updated_idx"
  ON "story_worlds" USING btree ("genre", "updated_at");
