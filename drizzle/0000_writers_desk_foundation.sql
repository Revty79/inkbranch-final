CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text NOT NULL CHECK ("role" IN ('READER', 'AUTHOR', 'ADMIN')),
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_worlds" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"premise" text,
	"reader_agency" text,
	"ai_directive" text,
	"status" text DEFAULT 'DRAFT' NOT NULL CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "story_worlds_slug_unique_idx" ON "story_worlds" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_worlds_author_updated_idx" ON "story_worlds" USING btree ("author_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_worlds_status_updated_idx" ON "story_worlds" USING btree ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_spine_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL REFERENCES "story_worlds"("id") ON DELETE CASCADE,
	"version" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"arc_statement" text,
	"tone_guide" text,
	"narrative_boundaries" text,
	"guardrail_instruction" text,
	"created_by_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "world_spine_versions_world_version_uidx" UNIQUE("world_id", "version")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_spine_versions_world_active_idx" ON "world_spine_versions" USING btree ("world_id", "is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"spine_version_id" text NOT NULL REFERENCES "world_spine_versions"("id") ON DELETE CASCADE,
	"rule_type" text NOT NULL CHECK ("rule_type" IN ('CANON', 'CHARACTER_TRUTH', 'REQUIRED_EVENT', 'OUTCOME')),
	"strength" text DEFAULT 'HARD' NOT NULL CHECK ("strength" IN ('HARD', 'SOFT')),
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "world_rules_spine_type_order_uidx" UNIQUE("spine_version_id", "rule_type", "sort_order")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_rules_spine_type_idx" ON "world_rules" USING btree ("spine_version_id", "rule_type");
