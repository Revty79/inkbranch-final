CREATE TABLE IF NOT EXISTS "chapter_viewpoints" (
  "id" text PRIMARY KEY,
  "chapter_id" text NOT NULL REFERENCES "story_turns"("id") ON DELETE CASCADE,
  "character_name" text NOT NULL,
  "lens" text NOT NULL DEFAULT 'MOMENT' CHECK ("lens" IN ('MOMENT', 'THREAD', 'SPINOFF')),
  "direction_input" text,
  "viewpoint_title" text,
  "ai_response" text NOT NULL,
  "model" text NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "chapter_viewpoints_chapter_created_idx"
  ON "chapter_viewpoints" ("chapter_id", "created_at");

CREATE INDEX IF NOT EXISTS "chapter_viewpoints_character_idx"
  ON "chapter_viewpoints" ("character_name");
