CREATE TABLE IF NOT EXISTS "library_books" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"world_id" text NOT NULL REFERENCES "story_worlds"("id") ON DELETE cascade,
	"source" text DEFAULT 'MANUAL_ADD' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_turns" ADD COLUMN IF NOT EXISTS "chapter_title" text;
--> statement-breakpoint
ALTER TABLE "story_turns" ADD COLUMN IF NOT EXISTS "choice_options" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_books_user_world_uidx" ON "library_books" USING btree ("user_id","world_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_books_user_created_idx" ON "library_books" USING btree ("user_id","created_at");
--> statement-breakpoint
INSERT INTO "library_books" ("id", "user_id", "world_id", "source", "created_at")
SELECT
  md5(random()::text || clock_timestamp()::text),
  sw."author_id",
  sw."id",
  'AUTHOR_AUTO',
  now()
FROM "story_worlds" sw
ON CONFLICT ("user_id", "world_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "library_books" ("id", "user_id", "world_id", "source", "created_at")
SELECT
  md5(random()::text || clock_timestamp()::text),
  ss."reader_id",
  ss."world_id",
  'MANUAL_ADD',
  now()
FROM "story_sessions" ss
ON CONFLICT ("user_id", "world_id") DO NOTHING;
