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
    bookstoreSeenAt: timestamp("bookstore_seen_at", {
      withTimezone: true,
      mode: "date",
    }),
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
    genre: text("genre"),
    premise: text("premise"),
    chapterCap: integer("chapter_cap"),
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
    index("story_worlds_genre_updated_idx").on(table.genre, table.updatedAt),
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

export const storySessions = pgTable(
  "story_sessions",
  {
    id: text("id").primaryKey(),
    worldId: text("world_id")
      .notNull()
      .references(() => storyWorlds.id, { onDelete: "cascade" }),
    readerId: text("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spineVersionId: text("spine_version_id").references(() => worldSpineVersions.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["ACTIVE", "COMPLETED", "ABANDONED"],
    })
      .notNull()
      .default("ACTIVE"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    readingSeconds: integer("reading_seconds").notNull().default(0),
  },
  (table) => [
    index("story_sessions_reader_status_idx").on(table.readerId, table.status),
    index("story_sessions_world_reader_idx").on(table.worldId, table.readerId),
  ],
);

export const libraryBooks = pgTable(
  "library_books",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    worldId: text("world_id")
      .notNull()
      .references(() => storyWorlds.id, { onDelete: "cascade" }),
    source: text("source", {
      enum: ["AUTHOR_AUTO", "MANUAL_ADD", "ADMIN_GRANT"],
    })
      .notNull()
      .default("MANUAL_ADD"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("library_books_user_world_uidx").on(table.userId, table.worldId),
    index("library_books_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const storyTurns = pgTable(
  "story_turns",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => storySessions.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    readerInput: text("reader_input").notNull(),
    chapterTitle: text("chapter_title"),
    choiceOptions: text("choice_options").notNull().default("[]"),
    aiResponse: text("ai_response").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("story_turns_session_turn_uidx").on(table.sessionId, table.turnIndex),
    index("story_turns_session_idx").on(table.sessionId),
  ],
);

export const chapterViewpoints = pgTable(
  "chapter_viewpoints",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => storyTurns.id, { onDelete: "cascade" }),
    characterName: text("character_name").notNull(),
    lens: text("lens", {
      enum: ["MOMENT", "THREAD", "SPINOFF"],
    })
      .notNull()
      .default("MOMENT"),
    directionInput: text("direction_input"),
    viewpointTitle: text("viewpoint_title"),
    aiResponse: text("ai_response").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("chapter_viewpoints_chapter_created_idx").on(table.chapterId, table.createdAt),
    index("chapter_viewpoints_character_idx").on(table.characterName),
  ],
);
