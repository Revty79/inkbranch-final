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

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email);

CREATE TABLE IF NOT EXISTS story_worlds (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  genre TEXT,
  premise TEXT,
  chapter_cap INTEGER CHECK (chapter_cap IS NULL OR chapter_cap BETWEEN 1 AND 500),
  reader_agency TEXT,
  ai_directive TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS story_worlds_slug_unique_idx ON story_worlds(slug);
CREATE INDEX IF NOT EXISTS story_worlds_author_updated_idx ON story_worlds(author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS story_worlds_status_updated_idx ON story_worlds(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS story_worlds_genre_updated_idx ON story_worlds(genre, updated_at DESC);

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

CREATE INDEX IF NOT EXISTS story_sessions_reader_status_idx ON story_sessions(reader_id, status);
CREATE INDEX IF NOT EXISTS story_sessions_world_reader_idx ON story_sessions(world_id, reader_id);

CREATE TABLE IF NOT EXISTS library_books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  world_id TEXT NOT NULL REFERENCES story_worlds(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'MANUAL_ADD' CHECK (source IN ('AUTHOR_AUTO', 'MANUAL_ADD', 'ADMIN_GRANT')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS library_books_user_world_uidx ON library_books(user_id, world_id);
CREATE INDEX IF NOT EXISTS library_books_user_created_idx ON library_books(user_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS story_turns_session_idx ON story_turns(session_id);

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

CREATE INDEX IF NOT EXISTS chapter_viewpoints_chapter_created_idx
  ON chapter_viewpoints(chapter_id, created_at);
CREATE INDEX IF NOT EXISTS chapter_viewpoints_character_idx
  ON chapter_viewpoints(character_name);

CREATE TABLE IF NOT EXISTS session_canon_baselines (
  session_id TEXT PRIMARY KEY REFERENCES story_sessions(id) ON DELETE CASCADE,
  world_id TEXT NOT NULL REFERENCES story_worlds(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_chapter_id TEXT REFERENCES story_turns(id) ON DELETE SET NULL,
  source_chapter_number INTEGER NOT NULL,
  chapter_one_summary TEXT,
  lead_character_names TEXT NOT NULL DEFAULT '[]',
  notable_place_names TEXT NOT NULL DEFAULT '[]',
  canonical_facts TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS session_canon_baselines_world_reader_idx
  ON session_canon_baselines(world_id, reader_id);
CREATE INDEX IF NOT EXISTS session_canon_baselines_updated_idx
  ON session_canon_baselines(updated_at);

CREATE TABLE IF NOT EXISTS session_chapter_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES story_turns(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  chapter_title TEXT NOT NULL,
  opening_state TEXT,
  ending_state TEXT,
  active_character_names TEXT NOT NULL DEFAULT '[]',
  active_place_names TEXT NOT NULL DEFAULT '[]',
  unresolved_threads TEXT NOT NULL DEFAULT '[]',
  major_events TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(session_id, chapter_number),
  UNIQUE(chapter_id)
);

CREATE INDEX IF NOT EXISTS session_chapter_snapshots_session_updated_idx
  ON session_chapter_snapshots(session_id, updated_at);

CREATE TABLE IF NOT EXISTS session_event_ledger (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES story_turns(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  event_kind TEXT NOT NULL DEFAULT 'EVENT'
    CHECK (event_kind IN ('EVENT', 'REVEAL', 'COMMITMENT', 'STATE_CHANGE', 'CLIFFHANGER')),
  summary TEXT NOT NULL,
  subject_key TEXT,
  importance INTEGER NOT NULL DEFAULT 1
    CHECK (importance BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS session_event_ledger_session_chapter_idx
  ON session_event_ledger(session_id, chapter_number);
CREATE INDEX IF NOT EXISTS session_event_ledger_session_importance_idx
  ON session_event_ledger(session_id, importance);
CREATE INDEX IF NOT EXISTS session_event_ledger_chapter_idx
  ON session_event_ledger(chapter_id);
