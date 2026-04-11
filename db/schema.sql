CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('READER', 'AUTHOR', 'ADMIN')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);

CREATE TABLE IF NOT EXISTS story_worlds (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  premise TEXT,
  reader_agency TEXT,
  ai_directive TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS story_worlds_slug_unique_idx ON story_worlds(slug);
CREATE INDEX IF NOT EXISTS story_worlds_author_updated_idx ON story_worlds(author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS story_worlds_status_updated_idx ON story_worlds(status, updated_at DESC);

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

CREATE INDEX IF NOT EXISTS world_spine_versions_world_active_idx ON world_spine_versions(world_id, is_active);

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

CREATE INDEX IF NOT EXISTS world_rules_spine_type_idx ON world_rules(spine_version_id, rule_type);
