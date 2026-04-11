import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role", {
      enum: ["READER", "AUTHOR", "ADMIN"],
    }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(table.email)],
);

export const storyWorlds = pgTable(
  "story_worlds",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    premise: text("premise"),
    readerAgency: text("reader_agency"),
    aiDirective: text("ai_directive"),
    status: text("status", {
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
    })
      .notNull()
      .default("DRAFT"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("story_worlds_slug_unique_idx").on(table.slug),
    index("story_worlds_author_updated_idx").on(table.authorId, table.updatedAt),
    index("story_worlds_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

export const worldSpineVersions = pgTable(
  "world_spine_versions",
  {
    id: text("id").primaryKey(),
    worldId: text("world_id")
      .notNull()
      .references(() => storyWorlds.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    arcStatement: text("arc_statement"),
    toneGuide: text("tone_guide"),
    narrativeBoundaries: text("narrative_boundaries"),
    guardrailInstruction: text("guardrail_instruction"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("world_spine_versions_world_version_uidx").on(
      table.worldId,
      table.version,
    ),
    index("world_spine_versions_world_active_idx").on(table.worldId, table.isActive),
  ],
);

export const worldRules = pgTable(
  "world_rules",
  {
    id: text("id").primaryKey(),
    spineVersionId: text("spine_version_id")
      .notNull()
      .references(() => worldSpineVersions.id, { onDelete: "cascade" }),
    ruleType: text("rule_type", {
      enum: ["CANON", "CHARACTER_TRUTH", "REQUIRED_EVENT", "OUTCOME"],
    }).notNull(),
    strength: text("strength", {
      enum: ["HARD", "SOFT"],
    })
      .notNull()
      .default("HARD"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("world_rules_spine_type_order_uidx").on(
      table.spineVersionId,
      table.ruleType,
      table.sortOrder,
    ),
    index("world_rules_spine_type_idx").on(table.spineVersionId, table.ruleType),
  ],
);
