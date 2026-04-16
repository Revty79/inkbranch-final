import { Pool, type PoolConfig } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  __inkbranchPool?: Pool;
  __inkbranchSchemaReady?: Promise<void>;
};

function isLikelyLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function resolveSslConfig(connectionString?: string): PoolConfig["ssl"] {
  const configuredFlag = process.env.POSTGRES_SSL?.trim().toLowerCase();
  const sslEnabledByFlag = configuredFlag === "true";

  if (sslEnabledByFlag) {
    return { rejectUnauthorized: false };
  }

  let hostname = process.env.POSTGRES_HOST?.trim() || "";

  if (connectionString) {
    try {
      hostname = new URL(connectionString).hostname;
    } catch {
      // Ignore parse failures and fall back to POSTGRES_HOST/default behavior.
    }
  }

  // Managed providers (Render, Neon, Supabase, etc.) usually require TLS.
  if (hostname && !isLikelyLocalHostname(hostname)) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

function resolvePoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();
  const ssl = resolveSslConfig(connectionString);

  if (connectionString) {
    return {
      connectionString,
      ssl,
    };
  }

  return {
    host: process.env.POSTGRES_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DATABASE?.trim() || "inkbranch",
    user: process.env.POSTGRES_USER?.trim() || "inkbranch_app",
    password: process.env.POSTGRES_PASSWORD,
    ssl,
  };
}

function getPoolInstance() {
  if (!globalForDatabase.__inkbranchPool) {
    globalForDatabase.__inkbranchPool = new Pool(resolvePoolConfig());
  }

  return globalForDatabase.__inkbranchPool;
}

async function initializeSchema() {
  const pool = getPoolInstance();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL CHECK (role IN ('READER', 'AUTHOR', 'ADMIN')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      bookstore_seen_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS story_worlds (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      premise TEXT,
      chapter_cap INTEGER CHECK (chapter_cap IS NULL OR chapter_cap BETWEEN 1 AND 500),
      reader_agency TEXT,
      ai_directive TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS world_spine_versions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES story_worlds(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      arc_statement TEXT,
      tone_guide TEXT,
      narrative_boundaries TEXT,
      guardrail_instruction TEXT,
      created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(world_id, version)
    );

    CREATE TABLE IF NOT EXISTS world_rules (
      id TEXT PRIMARY KEY,
      spine_version_id TEXT NOT NULL REFERENCES world_spine_versions(id) ON DELETE CASCADE,
      rule_type TEXT NOT NULL CHECK (rule_type IN ('CANON', 'CHARACTER_TRUTH', 'REQUIRED_EVENT', 'OUTCOME')),
      strength TEXT NOT NULL DEFAULT 'HARD' CHECK (strength IN ('HARD', 'SOFT')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(spine_version_id, rule_type, sort_order)
    );

    CREATE TABLE IF NOT EXISTS story_sessions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES story_worlds(id) ON DELETE CASCADE,
      reader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      spine_version_id TEXT REFERENCES world_spine_versions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')),
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL,
      reading_seconds INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS library_books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      world_id TEXT NOT NULL REFERENCES story_worlds(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'MANUAL_ADD' CHECK (source IN ('AUTHOR_AUTO', 'MANUAL_ADD', 'ADMIN_GRANT')),
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
      turn_index INTEGER NOT NULL,
      reader_input TEXT NOT NULL,
      chapter_title TEXT,
      choice_options TEXT NOT NULL DEFAULT '[]',
      ai_response TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE(session_id, turn_index)
    );

    CREATE TABLE IF NOT EXISTS chapter_viewpoints (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL REFERENCES story_turns(id) ON DELETE CASCADE,
      character_name TEXT NOT NULL,
      lens TEXT NOT NULL DEFAULT 'MOMENT' CHECK (lens IN ('MOMENT', 'THREAD', 'SPINOFF')),
      direction_input TEXT,
      viewpoint_title TEXT,
      ai_response TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    ALTER TABLE story_turns
      ADD COLUMN IF NOT EXISTS chapter_title TEXT;
    ALTER TABLE story_turns
      ADD COLUMN IF NOT EXISTS choice_options TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE story_worlds
      ADD COLUMN IF NOT EXISTS chapter_cap INTEGER;
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bookstore_seen_at TIMESTAMPTZ;
    ALTER TABLE story_sessions
      ADD COLUMN IF NOT EXISTS reading_seconds INTEGER NOT NULL DEFAULT 0;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'story_worlds_chapter_cap_chk'
      ) THEN
        ALTER TABLE story_worlds
        ADD CONSTRAINT story_worlds_chapter_cap_chk
        CHECK (chapter_cap IS NULL OR chapter_cap BETWEEN 1 AND 500);
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS story_worlds_slug_unique_idx ON story_worlds(slug);
    CREATE INDEX IF NOT EXISTS story_worlds_author_updated_idx ON story_worlds(author_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS story_worlds_status_updated_idx ON story_worlds(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS world_spine_versions_world_active_idx ON world_spine_versions(world_id, is_active);
    CREATE INDEX IF NOT EXISTS world_rules_spine_type_idx ON world_rules(spine_version_id, rule_type);
    CREATE INDEX IF NOT EXISTS story_sessions_reader_status_idx ON story_sessions(reader_id, status);
    CREATE INDEX IF NOT EXISTS story_sessions_world_reader_idx ON story_sessions(world_id, reader_id);
    CREATE UNIQUE INDEX IF NOT EXISTS library_books_user_world_uidx ON library_books(user_id, world_id);
    CREATE INDEX IF NOT EXISTS library_books_user_created_idx ON library_books(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS story_turns_session_idx ON story_turns(session_id);
    CREATE INDEX IF NOT EXISTS chapter_viewpoints_chapter_created_idx ON chapter_viewpoints(chapter_id, created_at);
    CREATE INDEX IF NOT EXISTS chapter_viewpoints_character_idx ON chapter_viewpoints(character_name);
  `);
}

export async function getDatabase() {
  if (!globalForDatabase.__inkbranchSchemaReady) {
    globalForDatabase.__inkbranchSchemaReady = initializeSchema().catch(
      (error) => {
        globalForDatabase.__inkbranchSchemaReady = undefined;
        throw error;
      },
    );
  }

  await globalForDatabase.__inkbranchSchemaReady;

  return getPoolInstance();
}
