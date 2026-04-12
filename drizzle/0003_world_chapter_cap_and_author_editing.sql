ALTER TABLE "story_worlds" ADD COLUMN IF NOT EXISTS "chapter_cap" integer;
--> statement-breakpoint
UPDATE "story_worlds"
SET "chapter_cap" = NULL
WHERE "chapter_cap" IS NOT NULL
  AND ("chapter_cap" < 1 OR "chapter_cap" > 500);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'story_worlds_chapter_cap_chk'
  ) THEN
    ALTER TABLE "story_worlds"
    ADD CONSTRAINT "story_worlds_chapter_cap_chk"
    CHECK ("chapter_cap" IS NULL OR "chapter_cap" BETWEEN 1 AND 500);
  END IF;
END $$;
