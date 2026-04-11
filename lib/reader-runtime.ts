import { randomUUID } from "node:crypto";

import type { AppRole, PublicUser } from "@/lib/auth-types";
import { generateStoryText } from "@/lib/ai/gemini";
import { getDatabase } from "@/lib/db";

export type ReaderSessionStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";
export type LibrarySource = "AUTHOR_AUTO" | "MANUAL_ADD" | "ADMIN_GRANT";

export type LibraryBook = {
  id: string;
  worldId: string;
  title: string;
  slug: string;
  premise: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  authorName: string | null;
  authorEmail: string;
  source: LibrarySource;
  addedAt: string;
  activeSessionId: string | null;
  activeChapterCount: number;
};

export type CatalogWorld = {
  id: string;
  title: string;
  slug: string;
  premise: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  authorName: string | null;
  authorEmail: string;
};

export type ReaderSessionSummary = {
  id: string;
  worldId: string;
  worldTitle: string;
  worldSlug: string;
  status: ReaderSessionStatus;
  startedAt: string;
  updatedAt: string;
  chapterCount: number;
  lastChapterTitle: string | null;
};

export type ReaderChapter = {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  directionInput: string;
  choiceOptions: string[];
  model: string;
  createdAt: string;
};

export type ReaderSessionDetail = {
  session: ReaderSessionSummary;
  libraryBook: LibraryBook;
  spine: {
    id: string;
    arcStatement: string | null;
    toneGuide: string | null;
    narrativeBoundaries: string | null;
    guardrailInstruction: string | null;
    readerAgency: string | null;
    aiDirective: string | null;
  };
  rules: {
    canon: string[];
    characterTruths: string[];
    requiredEvents: string[];
    outcomes: string[];
  };
  chapters: ReaderChapter[];
};

type LibraryBookRow = {
  library_book_id: string;
  world_id: string;
  title: string;
  slug: string;
  premise: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  author_name: string | null;
  author_email: string;
  source: LibrarySource;
  added_at: Date | string;
  active_session_id: string | null;
  active_chapter_count: number | string | null;
};

type CatalogWorldRow = {
  id: string;
  title: string;
  slug: string;
  premise: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  author_name: string | null;
  author_email: string;
};

type SessionSummaryRow = {
  id: string;
  world_id: string;
  world_title: string;
  world_slug: string;
  status: ReaderSessionStatus;
  started_at: Date | string;
  updated_at: Date | string;
  chapter_count: number | string;
  last_chapter_title: string | null;
};

type SessionCoreRow = {
  session_id: string;
  session_status: ReaderSessionStatus;
  started_at: Date | string;
  updated_at: Date | string;
  world_id: string;
  world_title: string;
  world_slug: string;
  world_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  world_premise: string | null;
  reader_agency: string | null;
  ai_directive: string | null;
  author_name: string | null;
  author_email: string;
  library_book_id: string;
  library_source: LibrarySource;
  library_added_at: Date | string;
  active_spine_id: string;
  active_spine_version: number | string;
  arc_statement: string | null;
  tone_guide: string | null;
  narrative_boundaries: string | null;
  guardrail_instruction: string | null;
};

type RuleRow = {
  rule_type: "CANON" | "CHARACTER_TRUTH" | "REQUIRED_EVENT" | "OUTCOME";
  title: string;
  description: string;
  strength: "HARD" | "SOFT";
};

type ChapterRow = {
  id: string;
  turn_index: number | string;
  reader_input: string;
  chapter_title: string | null;
  choice_options: string | null;
  ai_response: string;
  model: string;
  created_at: Date | string;
};

const MAX_DIRECTION_LENGTH = 2500;
const MAX_CHAPTER_HISTORY_IN_PROMPT = 8;
const CHAPTER_TARGET_WORDS_MIN = 1800;
const CHAPTER_TARGET_WORDS_MAX = 3200;
const CHAPTER_GENERATION_ATTEMPTS = 3;

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function safeParseChoiceOptions(input: string | null | undefined): string[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    return [];
  } catch {
    return [];
  }
}

function formatRuleLine(title: string, description: string, strength: string) {
  return `${title}: ${description} [${strength}]`;
}

function countWords(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function isWorldReadableFor(role: AppRole, userId: string, world: { status: string; authorId: string }) {
  if (role === "ADMIN") {
    return true;
  }

  if (role === "AUTHOR") {
    return world.status === "PUBLISHED" || world.authorId === userId;
  }

  return world.status === "PUBLISHED";
}

function buildFallbackChoices(chapterNumber: number) {
  return [
    "Press deeper into the current conflict.",
    "Step back and investigate hidden context.",
    `Take a risky turn that could change chapter ${chapterNumber + 1}.`,
  ];
}

function toLibraryBook(row: LibraryBookRow): LibraryBook {
  return {
    id: row.library_book_id,
    worldId: row.world_id,
    title: row.title,
    slug: row.slug,
    premise: row.premise,
    status: row.status,
    authorName: row.author_name,
    authorEmail: row.author_email,
    source: row.source,
    addedAt: new Date(row.added_at).toISOString(),
    activeSessionId: row.active_session_id,
    activeChapterCount: toNumber(row.active_chapter_count),
  };
}

function buildChapterPrompt(
  detail: ReaderSessionDetail,
  chapterNumber: number,
  directionInput: string,
) {
  const recentChapters = detail.chapters.slice(-MAX_CHAPTER_HISTORY_IN_PROMPT);

  const sections = [
    "You are the InkBranch chapter writer.",
    "Write the next chapter of an interactive ebook.",
    "Follow canon and constraints. Keep tone consistent.",
    "Return valid JSON only, no markdown fences.",
    "",
    "JSON schema:",
    '{"chapterTitle":"string","chapterBody":"string","choices":["string","string","string"]}',
    "",
    `World: ${detail.libraryBook.title}`,
    detail.libraryBook.premise ? `Premise: ${detail.libraryBook.premise}` : null,
    detail.spine.arcStatement ? `Arc statement: ${detail.spine.arcStatement}` : null,
    detail.spine.toneGuide ? `Tone guide: ${detail.spine.toneGuide}` : null,
    detail.spine.narrativeBoundaries
      ? `Narrative boundaries: ${detail.spine.narrativeBoundaries}`
      : null,
    detail.spine.guardrailInstruction
      ? `Guardrail instruction: ${detail.spine.guardrailInstruction}`
      : null,
    detail.spine.readerAgency
      ? `Reader agency contract: ${detail.spine.readerAgency}`
      : null,
    detail.spine.aiDirective ? `AI directive: ${detail.spine.aiDirective}` : null,
    "",
    "Canon rules:",
    ...(detail.rules.canon.length
      ? detail.rules.canon.map((rule) => `- ${rule}`)
      : ["- None specified"]),
    "",
    "Character truths:",
    ...(detail.rules.characterTruths.length
      ? detail.rules.characterTruths.map((rule) => `- ${rule}`)
      : ["- None specified"]),
    "",
    "Required events:",
    ...(detail.rules.requiredEvents.length
      ? detail.rules.requiredEvents.map((rule) => `- ${rule}`)
      : ["- None specified"]),
    "",
    "Outcome constraints:",
    ...(detail.rules.outcomes.length
      ? detail.rules.outcomes.map((rule) => `- ${rule}`)
      : ["- None specified"]),
    "",
    "Prior chapters:",
    ...(recentChapters.length
      ? recentChapters.flatMap((chapter) => [
          `Chapter ${chapter.chapterNumber} title: ${chapter.title}`,
          `Chapter ${chapter.chapterNumber} direction: ${chapter.directionInput}`,
          `Chapter ${chapter.chapterNumber} content: ${chapter.content}`,
        ])
      : ["No prior chapters yet."]),
    "",
    `Target chapter number: ${chapterNumber}`,
    `Reader direction for this chapter: ${directionInput}`,
    "",
    "Requirements:",
    `- chapterBody must be ${CHAPTER_TARGET_WORDS_MIN} to ${CHAPTER_TARGET_WORDS_MAX} words.`,
    "- chapterBody should read like a real novel chapter with multiple scene beats.",
    "- Use natural sectioning and pacing; do not force a fixed paragraph count.",
    "- choices must contain exactly 3 concise options for the next chapter.",
    "- Keep chapter progression meaningful and coherent.",
  ];

  return sections.filter((part): part is string => Boolean(part)).join("\n");
}

function buildChapterExpansionPrompt(options: {
  chapterNumber: number;
  directionInput: string;
  currentTitle: string;
  currentBody: string;
  currentChoices: string[];
}) {
  return [
    "Revise and expand this chapter draft.",
    "Return valid JSON only, no markdown fences.",
    "JSON schema:",
    '{"chapterTitle":"string","chapterBody":"string","choices":["string","string","string"]}',
    "",
    `Chapter number: ${options.chapterNumber}`,
    `Reader direction: ${options.directionInput}`,
    `Current chapter title: ${options.currentTitle}`,
    "Current chapter body:",
    options.currentBody,
    "",
    "Current choices:",
    ...options.currentChoices.map((choice) => `- ${choice}`),
    "",
    "Requirements:",
    `- Expand chapterBody to ${CHAPTER_TARGET_WORDS_MIN} to ${CHAPTER_TARGET_WORDS_MAX} words.`,
    "- Ensure the expanded chapter feels like a full novel chapter, not a short scene.",
    "- Keep continuity and core events from the current draft.",
    "- Keep prose quality high and avoid repetition.",
    "- Return exactly 3 strong next-chapter choices.",
  ].join("\n");
}

function parseChapterOutput(raw: string, chapterNumber: number) {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(withoutFences) as {
      chapterTitle?: unknown;
      chapterBody?: unknown;
      choices?: unknown;
    };

    const chapterTitle =
      typeof parsed.chapterTitle === "string" && parsed.chapterTitle.trim()
        ? parsed.chapterTitle.trim().slice(0, 180)
        : `Chapter ${chapterNumber}`;

    const chapterBody =
      typeof parsed.chapterBody === "string" && parsed.chapterBody.trim()
        ? parsed.chapterBody.trim()
        : trimmed;

    const parsedChoices = Array.isArray(parsed.choices)
      ? parsed.choices
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    const choiceOptions =
      parsedChoices.length >= 3
        ? parsedChoices
        : [...parsedChoices, ...buildFallbackChoices(chapterNumber)].slice(0, 3);

    return {
      chapterTitle,
      chapterBody,
      choiceOptions,
    };
  } catch {
    return {
      chapterTitle: `Chapter ${chapterNumber}`,
      chapterBody: trimmed,
      choiceOptions: buildFallbackChoices(chapterNumber),
    };
  }
}

export async function listLibraryBooks(user: PublicUser): Promise<LibraryBook[]> {
  const db = await getDatabase();
  const result = await db.query<LibraryBookRow>(
    `
      SELECT
        lb.id AS library_book_id,
        lb.world_id,
        worlds.title,
        worlds.slug,
        worlds.premise,
        worlds.status,
        authors.name AS author_name,
        authors.email AS author_email,
        lb.source,
        lb.created_at AS added_at,
        active_session.id AS active_session_id,
        COALESCE(active_session_chapters.chapter_count, 0) AS active_chapter_count
      FROM library_books AS lb
      JOIN story_worlds AS worlds
        ON worlds.id = lb.world_id
      JOIN users AS authors
        ON authors.id = worlds.author_id
      LEFT JOIN LATERAL (
        SELECT id
        FROM story_sessions
        WHERE reader_id = lb.user_id
          AND world_id = lb.world_id
          AND status = 'ACTIVE'
        ORDER BY updated_at DESC
        LIMIT 1
      ) AS active_session
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS chapter_count
        FROM story_turns
        WHERE session_id = active_session.id
      ) AS active_session_chapters
        ON TRUE
      WHERE lb.user_id = $1
      ORDER BY lb.created_at DESC
    `,
    [user.id],
  );

  return result.rows.map(toLibraryBook);
}

export async function listLibraryCatalogWorlds(user: PublicUser): Promise<CatalogWorld[]> {
  const db = await getDatabase();
  const result = await db.query<CatalogWorldRow>(
    `
      SELECT
        worlds.id,
        worlds.title,
        worlds.slug,
        worlds.premise,
        worlds.status,
        authors.name AS author_name,
        authors.email AS author_email
      FROM story_worlds AS worlds
      JOIN users AS authors
        ON authors.id = worlds.author_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM library_books AS lb
        WHERE lb.user_id = $2
          AND lb.world_id = worlds.id
      )
        AND (
          $1 = 'ADMIN'
          OR ($1 = 'AUTHOR' AND (worlds.status = 'PUBLISHED' OR worlds.author_id = $2))
          OR ($1 = 'READER' AND worlds.status = 'PUBLISHED')
        )
      ORDER BY worlds.updated_at DESC
    `,
    [user.role, user.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    premise: row.premise,
    status: row.status,
    authorName: row.author_name,
    authorEmail: row.author_email,
  }));
}

export async function addWorldToLibrary(user: PublicUser, worldId: string): Promise<LibraryBook> {
  const db = await getDatabase();
  const worldResult = await db.query<{
    id: string;
    author_id: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  }>(
    `
      SELECT id, author_id, status
      FROM story_worlds
      WHERE id = $1
      LIMIT 1
    `,
    [worldId],
  );

  const world = worldResult.rows[0];

  if (!world) {
    throw new Error("Book not found.");
  }

  if (!isWorldReadableFor(user.role, user.id, { status: world.status, authorId: world.author_id })) {
    throw new Error("You do not have access to add this book to your library.");
  }

  const createdAt = new Date().toISOString();
  const source = user.role === "ADMIN" ? "ADMIN_GRANT" : "MANUAL_ADD";

  await db.query(
    `
      INSERT INTO library_books (
        id,
        user_id,
        world_id,
        source,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, world_id) DO NOTHING
    `,
    [randomUUID(), user.id, worldId, source, createdAt],
  );

  const books = await listLibraryBooks(user);
  const addedBook = books.find((book) => book.worldId === worldId);

  if (!addedBook) {
    throw new Error("Book could not be added to your library.");
  }

  return addedBook;
}

export async function listReaderSessions(userId: string): Promise<ReaderSessionSummary[]> {
  const db = await getDatabase();
  const result = await db.query<SessionSummaryRow>(
    `
      SELECT
        sessions.id,
        sessions.world_id,
        worlds.title AS world_title,
        worlds.slug AS world_slug,
        sessions.status,
        sessions.started_at,
        sessions.updated_at,
        COALESCE(COUNT(turns.id), 0) AS chapter_count,
        (
          ARRAY_AGG(turns.chapter_title ORDER BY turns.turn_index DESC)
        )[1] AS last_chapter_title
      FROM story_sessions AS sessions
      JOIN story_worlds AS worlds
        ON worlds.id = sessions.world_id
      LEFT JOIN story_turns AS turns
        ON turns.session_id = sessions.id
      WHERE sessions.reader_id = $1
      GROUP BY
        sessions.id,
        sessions.world_id,
        worlds.title,
        worlds.slug,
        sessions.status,
        sessions.started_at,
        sessions.updated_at
      ORDER BY sessions.updated_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    worldId: row.world_id,
    worldTitle: row.world_title,
    worldSlug: row.world_slug,
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    chapterCount: toNumber(row.chapter_count),
    lastChapterTitle: row.last_chapter_title,
  }));
}

export async function getReaderSessionDetail(
  user: PublicUser,
  sessionId: string,
): Promise<ReaderSessionDetail | null> {
  const db = await getDatabase();
  const coreResult = await db.query<SessionCoreRow>(
    `
      SELECT
        sessions.id AS session_id,
        sessions.status AS session_status,
        sessions.started_at,
        sessions.updated_at,
        worlds.id AS world_id,
        worlds.title AS world_title,
        worlds.slug AS world_slug,
        worlds.status AS world_status,
        worlds.premise AS world_premise,
        worlds.reader_agency,
        worlds.ai_directive,
        authors.name AS author_name,
        authors.email AS author_email,
        lb.id AS library_book_id,
        lb.source AS library_source,
        lb.created_at AS library_added_at,
        spine.id AS active_spine_id,
        COALESCE(spine.version, 1) AS active_spine_version,
        spine.arc_statement,
        spine.tone_guide,
        spine.narrative_boundaries,
        spine.guardrail_instruction
      FROM story_sessions AS sessions
      JOIN story_worlds AS worlds
        ON worlds.id = sessions.world_id
      JOIN users AS authors
        ON authors.id = worlds.author_id
      JOIN library_books AS lb
        ON lb.user_id = sessions.reader_id
       AND lb.world_id = sessions.world_id
      LEFT JOIN world_spine_versions AS spine
        ON spine.id = sessions.spine_version_id
      WHERE sessions.id = $1
        AND (sessions.reader_id = $2 OR $3 = 'ADMIN')
      LIMIT 1
    `,
    [sessionId, user.id, user.role],
  );

  const core = coreResult.rows[0];

  if (!core || !core.active_spine_id) {
    return null;
  }

  const [rulesResult, chaptersResult] = await Promise.all([
    db.query<RuleRow>(
      `
        SELECT rule_type, title, description, strength
        FROM world_rules
        WHERE spine_version_id = $1
        ORDER BY rule_type ASC, sort_order ASC
      `,
      [core.active_spine_id],
    ),
    db.query<ChapterRow>(
      `
        SELECT
          id,
          turn_index,
          reader_input,
          chapter_title,
          choice_options,
          ai_response,
          model,
          created_at
        FROM story_turns
        WHERE session_id = $1
        ORDER BY turn_index ASC
      `,
      [sessionId],
    ),
  ]);

  const rules = {
    canon: [] as string[],
    characterTruths: [] as string[],
    requiredEvents: [] as string[],
    outcomes: [] as string[],
  };

  for (const rule of rulesResult.rows) {
    const line = formatRuleLine(rule.title, rule.description, rule.strength);

    switch (rule.rule_type) {
      case "CANON":
        rules.canon.push(line);
        break;
      case "CHARACTER_TRUTH":
        rules.characterTruths.push(line);
        break;
      case "REQUIRED_EVENT":
        rules.requiredEvents.push(line);
        break;
      case "OUTCOME":
        rules.outcomes.push(line);
        break;
    }
  }

  const chapters = chaptersResult.rows.map((chapter) => {
    const chapterNumber = toNumber(chapter.turn_index);

    return {
      id: chapter.id,
      chapterNumber,
      title: chapter.chapter_title?.trim() || `Chapter ${chapterNumber}`,
      content: chapter.ai_response,
      directionInput: chapter.reader_input,
      choiceOptions: safeParseChoiceOptions(chapter.choice_options),
      model: chapter.model,
      createdAt: new Date(chapter.created_at).toISOString(),
    } satisfies ReaderChapter;
  });

  const session: ReaderSessionSummary = {
    id: core.session_id,
    worldId: core.world_id,
    worldTitle: core.world_title,
    worldSlug: core.world_slug,
    status: core.session_status,
    startedAt: new Date(core.started_at).toISOString(),
    updatedAt: new Date(core.updated_at).toISOString(),
    chapterCount: chapters.length,
    lastChapterTitle: chapters[chapters.length - 1]?.title ?? null,
  };

  const libraryBook: LibraryBook = {
    id: core.library_book_id,
    worldId: core.world_id,
    title: core.world_title,
    slug: core.world_slug,
    premise: core.world_premise,
    status: core.world_status,
    authorName: core.author_name,
    authorEmail: core.author_email,
    source: core.library_source,
    addedAt: new Date(core.library_added_at).toISOString(),
    activeSessionId: core.session_id,
    activeChapterCount: chapters.length,
  };

  return {
    session,
    libraryBook,
    spine: {
      id: core.active_spine_id,
      arcStatement: core.arc_statement,
      toneGuide: core.tone_guide,
      narrativeBoundaries: core.narrative_boundaries,
      guardrailInstruction: core.guardrail_instruction,
      readerAgency: core.reader_agency,
      aiDirective: core.ai_directive,
    },
    rules,
    chapters,
  };
}

async function insertChapterTurn(options: {
  sessionId: string;
  directionInput: string;
  chapterTitle: string;
  chapterBody: string;
  choiceOptions: string[];
  model: string;
}) {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  const turnId = randomUUID();

  await db.query("BEGIN");

  try {
    const lockResult = await db.query<{ status: ReaderSessionStatus }>(
      `
        SELECT status
        FROM story_sessions
        WHERE id = $1
        FOR UPDATE
      `,
      [options.sessionId],
    );

    const locked = lockResult.rows[0];

    if (!locked) {
      throw new Error("Reading session not found.");
    }

    if (locked.status !== "ACTIVE") {
      throw new Error("This reading session is no longer active.");
    }

    const nextIndexResult = await db.query<{ next_chapter_number: number | string }>(
      `
        SELECT COALESCE(MAX(turn_index), 0) + 1 AS next_chapter_number
        FROM story_turns
        WHERE session_id = $1
      `,
      [options.sessionId],
    );

    const chapterNumber = toNumber(nextIndexResult.rows[0]?.next_chapter_number ?? 1);
    const fallbackTitle = options.chapterTitle.trim() || `Chapter ${chapterNumber}`;

    await db.query(
      `
        INSERT INTO story_turns (
          id,
          session_id,
          turn_index,
          reader_input,
          chapter_title,
          choice_options,
          ai_response,
          model,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        turnId,
        options.sessionId,
        chapterNumber,
        options.directionInput,
        fallbackTitle,
        JSON.stringify(options.choiceOptions.slice(0, 3)),
        options.chapterBody,
        options.model,
        nowIso,
      ],
    );

    await db.query(
      `
        UPDATE story_sessions
        SET updated_at = $2
        WHERE id = $1
      `,
      [options.sessionId, nowIso],
    );

    await db.query("COMMIT");

    return {
      id: turnId,
      chapterNumber,
      title: fallbackTitle,
      content: options.chapterBody,
      directionInput: options.directionInput,
      choiceOptions: options.choiceOptions.slice(0, 3),
      model: options.model,
      createdAt: nowIso,
    } satisfies ReaderChapter;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function startReadingFromLibrary(user: PublicUser, libraryBookId: string) {
  const db = await getDatabase();
  const entryResult = await db.query<{
    id: string;
    world_id: string;
    active_spine_id: string | null;
  }>(
    `
      SELECT
        lb.id,
        lb.world_id,
        spine.id AS active_spine_id
      FROM library_books AS lb
      JOIN story_worlds AS worlds
        ON worlds.id = lb.world_id
      LEFT JOIN world_spine_versions AS spine
        ON spine.world_id = worlds.id
       AND spine.is_active = TRUE
      WHERE lb.id = $1
        AND lb.user_id = $2
      LIMIT 1
    `,
    [libraryBookId, user.id],
  );

  const entry = entryResult.rows[0];

  if (!entry) {
    throw new Error("Library book not found.");
  }

  if (!entry.active_spine_id) {
    throw new Error("This book does not have an active spine yet.");
  }

  const activeSessionResult = await db.query<{ id: string }>(
    `
      SELECT id
      FROM story_sessions
      WHERE world_id = $1
        AND reader_id = $2
        AND status = 'ACTIVE'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [entry.world_id, user.id],
  );

  const existingSessionId = activeSessionResult.rows[0]?.id;
  const sessionId = existingSessionId ?? randomUUID();

  if (!existingSessionId) {
    const nowIso = new Date().toISOString();

    await db.query(
      `
        INSERT INTO story_sessions (
          id,
          world_id,
          reader_id,
          spine_version_id,
          status,
          started_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        sessionId,
        entry.world_id,
        user.id,
        entry.active_spine_id,
        "ACTIVE" satisfies ReaderSessionStatus,
        nowIso,
        nowIso,
      ],
    );
  }

  let detail = await getReaderSessionDetail(user, sessionId);

  if (!detail) {
    throw new Error("Reading session could not be loaded.");
  }

  if (detail.chapters.length === 0) {
    const firstDirection = "Open chapter 1 with a strong hook and clear momentum.";
    const chapter1 = await generateNextChapter({
      user,
      sessionId,
      directionInput: firstDirection,
    });

    detail = await getReaderSessionDetail(user, sessionId);

    if (!detail) {
      throw new Error("Chapter 1 was generated, but session reload failed.");
    }

    return {
      session: detail,
      chapter: chapter1.chapter,
    };
  }

  return {
    session: detail,
    chapter: null,
  };
}

export async function generateNextChapter(options: {
  user: PublicUser;
  sessionId: string;
  directionInput?: string;
  model?: string;
}) {
  const direction = options.directionInput?.trim() || "Continue naturally from the previous chapter.";

  if (direction.length > MAX_DIRECTION_LENGTH) {
    throw new Error(`Direction must be ${MAX_DIRECTION_LENGTH} characters or less.`);
  }

  const detail = await getReaderSessionDetail(options.user, options.sessionId);

  if (!detail) {
    throw new Error("Reading session not found.");
  }

  if (detail.session.status !== "ACTIVE") {
    throw new Error("This reading session is no longer active.");
  }

  const chapterNumber = detail.chapters.length + 1;
  let parsed = {
    chapterTitle: `Chapter ${chapterNumber}`,
    chapterBody: "",
    choiceOptions: buildFallbackChoices(chapterNumber),
  };
  let modelUsed = options.model ?? "";

  for (let attempt = 1; attempt <= CHAPTER_GENERATION_ATTEMPTS; attempt += 1) {
    const prompt =
      attempt === 1
        ? buildChapterPrompt(detail, chapterNumber, direction)
        : buildChapterExpansionPrompt({
            chapterNumber,
            directionInput: direction,
            currentTitle: parsed.chapterTitle,
            currentBody: parsed.chapterBody,
            currentChoices: parsed.choiceOptions,
          });

    const generated = await generateStoryText({
      prompt,
      model: options.model,
    });

    parsed = parseChapterOutput(generated.text, chapterNumber);
    modelUsed = generated.model;

    if (countWords(parsed.chapterBody) >= CHAPTER_TARGET_WORDS_MIN) {
      break;
    }
  }

  const chapter = await insertChapterTurn({
    sessionId: options.sessionId,
    directionInput: direction,
    chapterTitle: parsed.chapterTitle,
    chapterBody: parsed.chapterBody,
    choiceOptions: parsed.choiceOptions,
    model: modelUsed || "unknown-model",
  });

  const sessionUpdatedAt = chapter.createdAt;

  return {
    chapter,
    sessionUpdatedAt,
  };
}
