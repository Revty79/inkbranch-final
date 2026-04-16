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
  chapterCap: number | null;
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

export type BookstoreBook = {
  id: string;
  title: string;
  slug: string;
  premise: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  authorName: string | null;
  authorEmail: string;
  inLibrary: boolean;
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
  characterCandidates: string[];
  viewpoints: ReaderChapterViewpoint[];
  directionInput: string;
  choiceOptions: string[];
  model: string;
  createdAt: string;
};

export type ReaderChapterViewpointLens = "MOMENT" | "THREAD" | "SPINOFF";

export type ReaderChapterViewpoint = {
  id: string;
  chapterId: string;
  chapterNumber: number;
  characterName: string;
  lens: ReaderChapterViewpointLens;
  title: string;
  content: string;
  directionInput: string | null;
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
  chapter_cap: number | string | null;
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

type BookstoreBookRow = CatalogWorldRow & {
  in_library: boolean;
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
  world_chapter_cap: number | string | null;
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

type ViewpointRow = {
  id: string;
  chapter_id: string;
  chapter_number: number | string;
  character_name: string;
  lens: ReaderChapterViewpointLens | string;
  direction_input: string | null;
  viewpoint_title: string | null;
  ai_response: string;
  model: string;
  created_at: Date | string;
};

type PriorChapterTextRow = {
  ai_response: string;
};

type ParsedChapterOutput = {
  chapterTitle: string;
  chapterBody: string;
  choiceOptions: string[];
  didParseJson: boolean;
};

type ParsedViewpointOutput = {
  viewpointTitle: string;
  viewpointBody: string;
  didParseJson: boolean;
};

type ChoiceContext = {
  chapterTitle?: string;
  chapterBody?: string;
  directionInput?: string;
};

type ChapterGenerationProfile = {
  historyChapters: number;
  chapterSummaryChars: number;
  targetWordsMin: number;
  targetWordsMax: number;
  generationAttempts: number;
  maxOutputTokens: number;
  temperature: number;
};

type ViewpointGenerationProfile = {
  targetWordsMin: number;
  targetWordsMax: number;
  minAcceptedWords: number;
  maxOutputTokens: number;
  temperature: number;
  lensLabel: string;
};

const MAX_DIRECTION_LENGTH = 2500;
const MAX_VIEWPOINT_CHARACTER_NAME_LENGTH = 80;
const MAX_VIEWPOINT_DIRECTION_LENGTH = 1600;
const CHAPTER_CONTINUITY_REVIEW_ENABLED =
  (process.env.READER_CHAPTER_CONTINUITY_REVIEW?.trim().toLowerCase() ?? "true") !==
  "false";
const CHAPTER_CONTINUITY_ENDING_CONTEXT_CHARS = 2200;
const DEFAULT_CHAPTER_GENERATION_PROFILE = "BALANCED";
const CHAPTER_GENERATION_PROFILES: Record<string, ChapterGenerationProfile> = {
  FAST: {
    historyChapters: 3,
    chapterSummaryChars: 1000,
    targetWordsMin: 1700,
    targetWordsMax: 2400,
    generationAttempts: 3,
    maxOutputTokens: 4300,
    temperature: 0.8,
  },
  BALANCED: {
    historyChapters: 4,
    chapterSummaryChars: 1300,
    targetWordsMin: 2400,
    targetWordsMax: 3400,
    generationAttempts: 3,
    maxOutputTokens: 6200,
    temperature: 0.85,
  },
  RICH: {
    historyChapters: 6,
    chapterSummaryChars: 1600,
    targetWordsMin: 3000,
    targetWordsMax: 4600,
    generationAttempts: 4,
    maxOutputTokens: 7600,
    temperature: 0.9,
  },
};
const SHORT_CHAPTER_RECOVERY_ATTEMPTS = 3;
const ABSOLUTE_MIN_CHAPTER_WORDS = 1600;
const CHOICE_MIN_SENTENCES = 2;
const CHOICE_MAX_SENTENCES = 3;
const CHOICE_MIN_WORDS = 16;
const CHOICE_MAX_WORDS = 110;
const MAX_READING_ACTIVITY_SECONDS_PER_UPDATE = 300;
const OVERUSED_NAME_SCAN_CHAPTER_LIMIT = 36;
const OVERUSED_NAME_MIN_CHAPTERS = 3;
const OVERUSED_NAME_MAX_RESULTS = 8;
const MAX_CHARACTER_CANDIDATES_PER_CHAPTER = 10;
const VIEWPOINT_GENERATION_ATTEMPTS = 3;
const VIEWPOINT_GENERATION_PROFILES: Record<
  ReaderChapterViewpointLens,
  ViewpointGenerationProfile
> = {
  MOMENT: {
    targetWordsMin: 320,
    targetWordsMax: 700,
    minAcceptedWords: 220,
    maxOutputTokens: 1800,
    temperature: 0.85,
    lensLabel: "short vignette",
  },
  THREAD: {
    targetWordsMin: 900,
    targetWordsMax: 1700,
    minAcceptedWords: 700,
    maxOutputTokens: 3600,
    temperature: 0.87,
    lensLabel: "extended side-story thread",
  },
  SPINOFF: {
    targetWordsMin: 1700,
    targetWordsMax: 2800,
    minAcceptedWords: 1350,
    maxOutputTokens: 6000,
    temperature: 0.9,
    lensLabel: "spinoff seed chapter",
  },
};
const CHOICE_META_ARTIFACT_PATTERNS = [
  /\bopen chapter\s*\d+\b/i,
  /\bstrong hook\b/i,
  /\bclear momentum\b/i,
  /\bcontinue naturally(?: from the previous chapter)?\b/i,
  /\breader direction\b/i,
];
const CHARACTER_ACTION_VERB_PATTERN =
  "(?:said|asked|replied|whispered|murmured|shouted|snapped|sighed|nodded|smiled|frowned|glanced|stared|looked|stepped|walked|ran|turned|leaned|paused|felt|thought|remembered|watched|pulled|pushed|grabbed|reached|hurried|froze|paid|began|started|moved|kept|waited|followed|opened|closed|wrote|read|spoke|listened|noticed)";
const LIKELY_CHARACTER_NAME_PATTERN = new RegExp(
  `\\b([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?)\\s+${CHARACTER_ACTION_VERB_PATTERN}\\b`,
  "g",
);
const HONORIFIC_NAME_PATTERN =
  /\b(?:Mr|Mrs|Ms|Dr)\.\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
const NON_CHARACTER_NAME_TOKENS = new Set([
  "chapter",
  "prologue",
  "epilogue",
  "part",
  "scene",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "north",
  "south",
  "east",
  "west",
  "the",
  "then",
  "there",
  "here",
]);
const NON_CHARACTER_PRONOUN_TOKENS = new Set([
  "he",
  "she",
  "him",
  "her",
  "his",
  "hers",
  "himself",
  "herself",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",
  "we",
  "us",
  "our",
  "ours",
  "ourselves",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  "i",
  "me",
  "my",
  "mine",
  "myself",
]);
const NON_CHARACTER_GENERIC_LABEL_TOKENS = new Set([
  "lady",
  "lord",
  "sir",
  "madam",
  "dame",
  "man",
  "woman",
  "boy",
  "girl",
  "child",
  "stranger",
  "guard",
  "soldier",
  "officer",
  "captain",
  "commander",
  "merchant",
  "servant",
  "driver",
  "bartender",
  "waiter",
  "waitress",
  "narrator",
  "mother",
  "father",
  "sister",
  "brother",
]);
const CHARACTER_TITLE_PREFIX_TOKENS = new Set([
  "lady",
  "lord",
  "sir",
  "madam",
  "dame",
  "captain",
  "commander",
  "master",
  "mistress",
  "queen",
  "king",
  "prince",
  "princess",
  "duke",
  "duchess",
  "baron",
  "baroness",
  "count",
  "countess",
]);
const CHARACTER_HONORIFIC_PREFIX_TOKENS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
]);

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value == null) {
    return null;
  }

  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalText(input: string | null | undefined) {
  if (typeof input !== "string") {
    return null;
  }

  const normalized = input.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function normalizeViewpointCharacterName(input: string) {
  return input
    .replace(/\r\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_VIEWPOINT_CHARACTER_NAME_LENGTH);
}

function toCharacterIdentityKey(name: string) {
  const normalized = normalizeViewpointCharacterName(name)
    .replace(/\./g, "")
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (
    parts.length >= 2 &&
    (CHARACTER_TITLE_PREFIX_TOKENS.has(parts[0]) ||
      CHARACTER_HONORIFIC_PREFIX_TOKENS.has(parts[0]))
  ) {
    return parts.slice(1).join(" ");
  }

  return parts.join(" ");
}

function toViewpointLens(input: string | null | undefined): ReaderChapterViewpointLens {
  const normalized = input?.trim().toUpperCase();

  if (
    normalized === "MOMENT" ||
    normalized === "THREAD" ||
    normalized === "SPINOFF"
  ) {
    return normalized;
  }

  return "MOMENT";
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
        .map((item) => normalizeChoice(item))
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

function countSentences(input: string) {
  const normalized = normalizeChoice(input);

  if (!normalized) {
    return 0;
  }

  const matches = normalized.match(/[^.!?]+[.!?]+(?=\s|$)/g);

  if (matches?.length) {
    return matches.length;
  }

  return 1;
}

function resolveChapterGenerationProfile(): ChapterGenerationProfile {
  const profileName = (
    process.env.READER_CHAPTER_GENERATION_PROFILE?.trim() ||
    DEFAULT_CHAPTER_GENERATION_PROFILE
  ).toUpperCase();

  return CHAPTER_GENERATION_PROFILES[profileName] ?? CHAPTER_GENERATION_PROFILES.FAST;
}

function resolveMinimumAcceptedChapterWords(profile: ChapterGenerationProfile) {
  const configuredFloorRaw = process.env.READER_CHAPTER_MIN_WORDS?.trim() || "";
  const configuredFloor = Number.parseInt(configuredFloorRaw, 10);
  const envFloor =
    Number.isFinite(configuredFloor) && configuredFloor > 0
      ? configuredFloor
      : ABSOLUTE_MIN_CHAPTER_WORDS;

  // Allow slight variance from target while still preventing under-delivered chapters.
  const profileFloor = Math.floor(profile.targetWordsMin * 0.9);

  return Math.max(envFloor, profileFloor);
}

function summarizeForPrompt(input: string, maxChars: number) {
  const normalized = normalizeChapterBody(input).replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "(empty chapter)";
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const headLength = Math.max(Math.floor(maxChars * 0.72), 120);
  const tailLength = Math.max(Math.floor(maxChars * 0.2), 60);
  const head = normalized.slice(0, headLength).trimEnd();
  const tail = normalized.slice(-tailLength).trimStart();

  return `${head} ... ${tail}`;
}

function isLikelyCharacterToken(token: string) {
  if (!token) {
    return false;
  }

  const trimmed = token.trim();

  if (!/^[A-Z][a-z]{2,}$/.test(trimmed)) {
    return false;
  }

  const normalized = trimmed.toLowerCase();

  if (NON_CHARACTER_NAME_TOKENS.has(normalized)) {
    return false;
  }

  if (NON_CHARACTER_PRONOUN_TOKENS.has(normalized)) {
    return false;
  }

  return true;
}

function isLikelyCharacterName(name: string) {
  if (!name) {
    return false;
  }

  const normalizedName = normalizeViewpointCharacterName(name);

  if (!normalizedName) {
    return false;
  }

  const parts = normalizedName.split(/\s+/).filter(Boolean);

  if (parts.length === 0 || parts.length > 2) {
    return false;
  }

  if (parts.length === 1) {
    const single = parts[0];

    if (!isLikelyCharacterToken(single)) {
      return false;
    }

    return !NON_CHARACTER_GENERIC_LABEL_TOKENS.has(single.toLowerCase());
  }

  const [first, second] = parts;

  if (!isLikelyCharacterToken(second)) {
    return false;
  }

  const firstLower = first.toLowerCase();

  if (CHARACTER_TITLE_PREFIX_TOKENS.has(firstLower)) {
    return true;
  }

  return isLikelyCharacterToken(first);
}

function extractLikelyCharacterNames(input: string) {
  const normalized = normalizeChapterBody(input);

  if (!normalized) {
    return [];
  }

  const names: string[] = [];
  let match: RegExpExecArray | null = null;

  LIKELY_CHARACTER_NAME_PATTERN.lastIndex = 0;

  while ((match = LIKELY_CHARACTER_NAME_PATTERN.exec(normalized)) !== null) {
    const candidate = normalizeViewpointCharacterName(match[1] ?? "");

    if (candidate && isLikelyCharacterName(candidate)) {
      names.push(candidate);
    }
  }

  HONORIFIC_NAME_PATTERN.lastIndex = 0;

  while ((match = HONORIFIC_NAME_PATTERN.exec(normalized)) !== null) {
    const candidate = normalizeViewpointCharacterName(match[1] ?? "");

    if (candidate && isLikelyCharacterName(candidate)) {
      names.push(candidate);
    }
  }

  return names;
}

function mergeDistinctCharacterNames(...groups: Array<readonly string[]>) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const rawName of group) {
      const normalized = normalizeViewpointCharacterName(rawName);

      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(normalized);

      if (merged.length >= MAX_CHARACTER_CANDIDATES_PER_CHAPTER) {
        return merged;
      }
    }
  }

  return merged;
}

function listCharacterCandidatesFromChapter(chapterTitle: string, chapterBody: string) {
  const fromBody = extractLikelyCharacterNames(chapterBody);
  const fromTitle = extractLikelyCharacterNames(chapterTitle);

  return mergeDistinctCharacterNames(fromBody, fromTitle);
}

function findOverusedCharacterNamesFromHistory(chapters: string[]) {
  const chapterPresenceCounts = new Map<string, number>();
  const displayNameByKey = new Map<string, string>();

  for (const chapterText of chapters) {
    const namesInChapter = new Set<string>();

    for (const name of extractLikelyCharacterNames(chapterText)) {
      namesInChapter.add(name);
    }

    for (const name of namesInChapter) {
      const key = name.toLowerCase();
      chapterPresenceCounts.set(key, (chapterPresenceCounts.get(key) ?? 0) + 1);

      if (!displayNameByKey.has(key)) {
        displayNameByKey.set(key, name);
      }
    }
  }

  return [...chapterPresenceCounts.entries()]
    .filter(([, count]) => count >= OVERUSED_NAME_MIN_CHAPTERS)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return a[0].localeCompare(b[0]);
    })
    .slice(0, OVERUSED_NAME_MAX_RESULTS)
    .map(([key]) => displayNameByKey.get(key) ?? key);
}

async function listOverusedCharacterNamesForReader(options: {
  readerId: string;
  currentWorldId: string;
}) {
  const db = await getDatabase();
  const result = await db.query<PriorChapterTextRow>(
    `
      SELECT turns.ai_response
      FROM story_turns AS turns
      JOIN story_sessions AS sessions
        ON sessions.id = turns.session_id
      WHERE sessions.reader_id = $1
        AND sessions.world_id <> $2
      ORDER BY turns.created_at DESC
      LIMIT $3
    `,
    [options.readerId, options.currentWorldId, OVERUSED_NAME_SCAN_CHAPTER_LIMIT],
  );

  return findOverusedCharacterNamesFromHistory(
    result.rows.map((row) => row.ai_response).filter(Boolean),
  );
}

function hasLikelyAbruptEnding(input: string) {
  const normalized = normalizeChapterBody(input);

  if (!normalized) {
    return true;
  }

  const lastChar = normalized.at(-1) ?? "";

  if (/[.!?'"\)\]]/.test(lastChar)) {
    return false;
  }

  const wordCount = countWords(normalized);
  return wordCount < 1400;
}

function normalizeChapterBody(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  const normalizedNewlines = trimmed
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  const withUnescapedNewlines =
    normalizedNewlines.includes("\\n") && !normalizedNewlines.includes("\n")
      ? normalizedNewlines.replace(/\\n/g, "\n")
      : normalizedNewlines;

  return withUnescapedNewlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripCodeContainer(input: string) {
  return input
    .trim()
    .replace(/^```(?:json|markdown|md|text)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^<pre[^>]*>\s*<code[^>]*>/i, "")
    .replace(/<\/code>\s*<\/pre>$/i, "")
    .replace(/^<code[^>]*>/i, "")
    .replace(/<\/code>$/i, "")
    .trim();
}

function decodeEscapedJsonText(input: string) {
  return input
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function normalizeChoice(choice: string) {
  return choice
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatChoicePrompt(choice: string) {
  const normalized = normalizeChoice(choice);

  if (!normalized) {
    return "";
  }

  const withLeadingCapital = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  if (/[.!?]$/.test(withLeadingCapital)) {
    return withLeadingCapital;
  }

  return `${withLeadingCapital}.`;
}

function isGenericChoice(choice: string) {
  const normalized = normalizeChoice(choice).toLowerCase();

  if (!normalized) {
    return true;
  }

  const genericPhrases = [
    "continue the story",
    "continue on",
    "keep going",
    "what happens next",
    "find out what happens",
    "learn more",
    "see what happens",
    "continue naturally",
  ];

  return genericPhrases.some((phrase) => normalized.includes(phrase));
}

function containsChoiceMetaArtifact(input: string) {
  const normalized = normalizeChoice(input);

  if (!normalized) {
    return false;
  }

  return CHOICE_META_ARTIFACT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function clipChoiceFocus(input: string, maxWords: number) {
  const normalized = normalizeChoice(input)
    .replace(/[.!?]+$/g, "")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\s+/)
    .slice(0, maxWords)
    .join(" ")
    .trim();
}

function toChoiceFocusCandidate(input: string, maxChars: number) {
  const summary = summarizeForPrompt(input, maxChars).replace(/[.!?]+$/g, "").trim();

  if (!summary || countWords(summary) < 3) {
    return "";
  }

  if (isGenericChoice(summary) || containsChoiceMetaArtifact(summary)) {
    return "";
  }

  return summary;
}

function isLowQualityChoice(choice: string) {
  const normalized = normalizeChoice(choice);

  if (!normalized) {
    return true;
  }

  const sentenceCount = countSentences(normalized);
  const wordCount = countWords(normalized);

  if (sentenceCount < CHOICE_MIN_SENTENCES || sentenceCount > CHOICE_MAX_SENTENCES) {
    return true;
  }

  if (wordCount < CHOICE_MIN_WORDS || wordCount > CHOICE_MAX_WORDS) {
    return true;
  }

  if (isGenericChoice(normalized)) {
    return true;
  }

  if (containsChoiceMetaArtifact(normalized)) {
    return true;
  }

  if (!/[a-zA-Z]/.test(normalized)) {
    return true;
  }

  return false;
}

function getChoiceFocus(context?: ChoiceContext) {
  const chapterTitle = context?.chapterTitle?.trim() || "";
  const chapterBody = context?.chapterBody?.trim() || "";
  const direction = context?.directionInput?.trim() || "";

  if (chapterTitle && !/^chapter\s+\d+/i.test(chapterTitle)) {
    const titleFocus = toChoiceFocusCandidate(chapterTitle, 70);

    if (titleFocus) {
      return titleFocus;
    }
  }

  if (chapterBody) {
    const candidateSentences = normalizeChapterBody(chapterBody)
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 3);

    for (const sentence of candidateSentences) {
      const sentenceFocus = toChoiceFocusCandidate(sentence, 90);

      if (sentenceFocus) {
        return sentenceFocus;
      }
    }
  }

  if (direction && countWords(direction) >= 4 && !/^continue\b/i.test(direction)) {
    const directionFocus = toChoiceFocusCandidate(direction, 70);

    if (directionFocus) {
      return directionFocus;
    }
  }

  return "the rising conflict at the heart of the story";
}

function buildFallbackChoices(chapterNumber: number, context?: ChoiceContext) {
  const focus = clipChoiceFocus(getChoiceFocus(context), 7) || "the central threat";
  const nextChapterNumber = chapterNumber + 1;

  return [
    `Escalate directly around ${focus} before the opposition can regroup and fortify. The move may secure a crucial advantage, but it will place one trusted ally in immediate danger.`,
    `Investigate the hidden truth behind ${focus} through a covert and risky approach. If the lead is real you gain leverage, but if it is bait you walk into a deliberate trap.`,
    `Force a public decision tied to ${focus} instead of waiting for perfect certainty. The fallout could fracture existing alliances and define the central stakes of chapter ${nextChapterNumber}.`,
  ].map((choice) => formatChoicePrompt(choice));
}

function finalizeChoiceOptions(
  choices: string[],
  chapterNumber: number,
  context?: ChoiceContext,
) {
  const selected: string[] = [];
  const seen = new Set<string>();

  for (const rawChoice of choices) {
    const formatted = formatChoicePrompt(rawChoice);
    const key = formatted.toLowerCase();

    if (!formatted || seen.has(key) || isLowQualityChoice(formatted)) {
      continue;
    }

    seen.add(key);
    selected.push(formatted);

    if (selected.length === 3) {
      return selected;
    }
  }

  const fallback = buildFallbackChoices(chapterNumber, context);

  for (const rawChoice of fallback) {
    const formatted = formatChoicePrompt(rawChoice);
    const key = formatted.toLowerCase();

    if (!formatted || seen.has(key) || isLowQualityChoice(formatted)) {
      continue;
    }

    seen.add(key);
    selected.push(formatted);

    if (selected.length === 3) {
      break;
    }
  }

  const emergencyFallbackChoices = [
    "Force a direct confrontation that answers one mystery and exposes a deeper threat. The outcome will settle one conflict now, but it will ignite a harder problem immediately after.",
    "Pursue the most dangerous lead before a rival can seize it and rewrite events. You might uncover decisive evidence, or you might trigger a trap that isolates your side.",
    `Make a costly strategic choice now rather than deferring the decision to chance. That commitment will reshape your position and set the stakes for chapter ${chapterNumber + 1}.`,
  ];

  for (const rawChoice of emergencyFallbackChoices) {
    if (selected.length === 3) {
      break;
    }

    const formatted = formatChoicePrompt(rawChoice);
    const key = formatted.toLowerCase();

    if (!formatted || seen.has(key) || isLowQualityChoice(formatted)) {
      continue;
    }

    seen.add(key);
    selected.push(formatted);
  }

  return selected.slice(0, 3);
}

function tryParseJsonObject(raw: string) {
  const cleaned = stripCodeContainer(raw);
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = cleaned.slice(firstBrace, lastBrace + 1);

    if (sliced !== cleaned) {
      candidates.push(sliced);
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as {
          chapterTitle?: unknown;
          chapterBody?: unknown;
          choices?: unknown;
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function tryRecoverMalformedJsonOutput(
  raw: string,
  chapterNumber: number,
  context?: ChoiceContext,
): ParsedChapterOutput | null {
  const cleaned = stripCodeContainer(raw);
  const chapterTitleMatch = cleaned.match(/"chapterTitle"\s*:\s*"((?:\\.|[^"])*)"/i);
  const chapterBodyMatch =
    cleaned.match(/"chapterBody"\s*:\s*"([\s\S]*?)"\s*,\s*"choices"\s*:/i) ??
    cleaned.match(/"chapterBody"\s*:\s*"([\s\S]*)$/i);

  if (!chapterBodyMatch) {
    return null;
  }

  const chapterTitle = chapterTitleMatch
    ? normalizeChapterBody(decodeEscapedJsonText(chapterTitleMatch[1])).slice(0, 180)
    : `Chapter ${chapterNumber}`;
  const chapterBody = normalizeChapterBody(decodeEscapedJsonText(chapterBodyMatch[1]));

  const choicesBlockMatch = cleaned.match(/"choices"\s*:\s*\[([\s\S]*?)\]/i);
  const choiceOptions =
    choicesBlockMatch
      ? [...choicesBlockMatch[1].matchAll(/"((?:\\.|[^"])*)"/g)]
          .map((match) => normalizeChoice(decodeEscapedJsonText(match[1])))
          .filter(Boolean)
          .slice(0, 3)
      : [];

  return {
    chapterTitle: chapterTitle || `Chapter ${chapterNumber}`,
    chapterBody,
    choiceOptions: finalizeChoiceOptions(choiceOptions, chapterNumber, {
      ...context,
      chapterTitle: chapterTitle || context?.chapterTitle,
      chapterBody: chapterBody || context?.chapterBody,
    }),
    didParseJson: true,
  };
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

function toLibraryBook(row: LibraryBookRow): LibraryBook {
  return {
    id: row.library_book_id,
    worldId: row.world_id,
    title: row.title,
    slug: row.slug,
    premise: row.premise,
    chapterCap: toNullableNumber(row.chapter_cap),
    status: row.status,
    authorName: row.author_name,
    authorEmail: row.author_email,
    source: row.source,
    addedAt: new Date(row.added_at).toISOString(),
    activeSessionId: row.active_session_id,
    activeChapterCount: toNumber(row.active_chapter_count),
  };
}

function toReaderChapterViewpoint(row: ViewpointRow): ReaderChapterViewpoint {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    chapterNumber: toNumber(row.chapter_number),
    characterName: normalizeViewpointCharacterName(row.character_name) || "Unknown Character",
    lens: toViewpointLens(row.lens),
    title: row.viewpoint_title?.trim() || "Untitled Viewpoint",
    content: normalizeChapterBody(row.ai_response),
    directionInput: normalizeOptionalText(row.direction_input),
    model: row.model,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function getChapterEndingContext(input: string, maxChars: number) {
  const normalized = normalizeChapterBody(input);

  if (!normalized) {
    return "(empty previous chapter)";
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return normalized.slice(-maxChars).trimStart();
}

function buildChapterPrompt(
  detail: ReaderSessionDetail,
  chapterNumber: number,
  directionInput: string,
  profile: ChapterGenerationProfile,
  overusedCharacterNames: string[],
) {
  const recentChapters = detail.chapters.slice(-profile.historyChapters);

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
    detail.libraryBook.chapterCap
      ? `Chapter cap: ${detail.libraryBook.chapterCap}`
      : "Chapter cap: none",
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
          `Chapter ${chapter.chapterNumber} summary: ${summarizeForPrompt(chapter.content, profile.chapterSummaryChars)}`,
          chapter.choiceOptions.length
            ? `Chapter ${chapter.chapterNumber} choices offered: ${chapter.choiceOptions.join(" | ")}`
            : null,
        ])
      : ["No prior chapters yet."]),
    "",
    overusedCharacterNames.length ? "Cross-book originality guard:" : null,
    overusedCharacterNames.length
      ? `- Avoid using these overused names as the chapter's central POV/protagonist unless canon explicitly requires it: ${overusedCharacterNames.join(", ")}`
      : null,
    "",
    "Continuity contract:",
    "- Treat the previous chapter ending as the immediate current reality for this chapter's opening.",
    "- Do not silently change place, time, weather, character positions, injuries, or objects in-hand.",
    "- If a transition is needed, explicitly narrate the move/time change before describing the new state.",
    "",
    `Target chapter number: ${chapterNumber}`,
    detail.libraryBook.chapterCap
      ? `You are writing chapter ${chapterNumber} of ${detail.libraryBook.chapterCap}.`
      : null,
    `Reader direction for this chapter: ${directionInput}`,
    "",
    "Requirements:",
    `- chapterBody must be ${profile.targetWordsMin} to ${profile.targetWordsMax} words.`,
    "- chapterBody should read like a real novel chapter with multiple scene beats.",
    "- Deliver substantial progression so the chapter feels satisfying to read, not like a brief scene.",
    "- Use natural sectioning and pacing; do not force a fixed paragraph count.",
    "- For opening chapters, start grounded and character-led; earn escalation instead of forcing immediate catastrophe.",
    "- Avoid repetitive opening templates and avoid copying recurring setup patterns from other books.",
    "- choices must contain exactly 3 concise options for the next chapter.",
    "- Each choice must be 2-3 complete sentences and specific to the chapter's events.",
    "- Each choice should be roughly 16-110 words, concrete, and immediately actionable.",
    "- Every choice must reference the chapter's concrete stakes, conflict, or revelation.",
    "- Avoid generic choices like 'continue' or 'see what happens'.",
    "- Keep chapter progression meaningful and coherent.",
    "- Do not wrap output in markdown fences or HTML tags such as <code>.",
  ];

  return sections.filter((part): part is string => Boolean(part)).join("\n");
}

function buildChapterExpansionPrompt(options: {
  chapterNumber: number;
  directionInput: string;
  currentTitle: string;
  currentBody: string;
  currentChoices: string[];
  profile: ChapterGenerationProfile;
  overusedCharacterNames: string[];
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
    options.overusedCharacterNames.length ? "Cross-book originality guard:" : null,
    options.overusedCharacterNames.length
      ? `- Avoid promoting these overused names into the central lead role unless canon explicitly requires it: ${options.overusedCharacterNames.join(", ")}`
      : null,
    "",
    "Continuity contract:",
    "- Keep the opening of this chapter anchored to the exact end state of the prior chapter unless an explicit transition is written on-page.",
    "- Do not silently change location, time of day, weather, injuries, objects in-hand, or character positions.",
    "- If scene/time/location changes, include a clear transition sentence before the new setting details.",
    "",
    "Requirements:",
    `- Expand chapterBody to ${options.profile.targetWordsMin} to ${options.profile.targetWordsMax} words.`,
    "- Ensure the expanded chapter feels like a full novel chapter, not a short scene.",
    "- Add meaningful progression, escalation, and consequence so chapter length feels earned.",
    "- If the opening is overly explosive, rebalance with grounded character context before escalation.",
    "- Keep continuity and core events from the current draft.",
    "- Keep prose quality high and avoid repetition.",
    "- Return exactly 3 strong next-chapter choices.",
    "- Each choice must be 2-3 complete sentences and grounded in chapter stakes.",
    "- Choices should be roughly 16-110 words, specific, and actionable (no vague filler).",
    "- Do not wrap output in markdown fences or HTML tags such as <code>.",
  ].join("\n");
}

function buildChapterContinuityRevisionPrompt(options: {
  previousChapter: ReaderChapter;
  chapterNumber: number;
  directionInput: string;
  chapterTitle: string;
  chapterBody: string;
  profile: ChapterGenerationProfile;
}) {
  return [
    "You are the InkBranch continuity editor.",
    "Your task is to enforce strict canon continuity between consecutive chapters.",
    "Return valid JSON only, no markdown fences.",
    "JSON schema:",
    '{"chapterTitle":"string","chapterBody":"string"}',
    "",
    `Previous chapter number: ${options.previousChapter.chapterNumber}`,
    `Previous chapter title: ${options.previousChapter.title}`,
    "Previous chapter ending context:",
    getChapterEndingContext(
      options.previousChapter.content,
      CHAPTER_CONTINUITY_ENDING_CONTEXT_CHARS,
    ),
    "",
    `Candidate chapter number: ${options.chapterNumber}`,
    `Candidate chapter title: ${options.chapterTitle}`,
    `Reader direction: ${options.directionInput}`,
    "Candidate chapter body:",
    options.chapterBody,
    "",
    "Continuity rules (must enforce):",
    "- The new chapter must begin from the same immediate reality as the previous chapter ending.",
    "- Do not silently move the story to a different location, time, or weather.",
    "- Do not silently reset injuries, object positions, clothing state, or unresolved actions.",
    "- If a location/time shift is needed, add explicit transition text that explains when/how the change happened.",
    "- Preserve established canon facts and character truths.",
    "- Keep the chapter's core plot intent and momentum.",
    "",
    "Output requirements:",
    `- Keep chapterBody in the same quality range and roughly ${options.profile.targetWordsMin}-${options.profile.targetWordsMax} words.`,
    "- Return only the corrected chapterTitle and chapterBody in JSON.",
  ].join("\n");
}

function parseChapterContinuityRevisionOutput(
  raw: string,
  fallbackTitle: string,
  fallbackBody: string,
) {
  const parsed = tryParseJsonObject(raw);

  if (!parsed) {
    return {
      chapterTitle: fallbackTitle,
      chapterBody: fallbackBody,
      didParseJson: false,
    };
  }

  const chapterTitle =
    typeof parsed.chapterTitle === "string" && parsed.chapterTitle.trim()
      ? normalizeChapterBody(parsed.chapterTitle).slice(0, 180)
      : fallbackTitle;
  const chapterBody =
    typeof parsed.chapterBody === "string" && parsed.chapterBody.trim()
      ? normalizeChapterBody(parsed.chapterBody)
      : fallbackBody;

  return {
    chapterTitle: chapterTitle || fallbackTitle,
    chapterBody: chapterBody || fallbackBody,
    didParseJson: true,
  };
}

function parseChapterOutput(
  raw: string,
  chapterNumber: number,
  context?: ChoiceContext,
) {
  const parsed = tryParseJsonObject(raw);

  if (parsed) {
    const chapterTitle =
      typeof parsed.chapterTitle === "string" && parsed.chapterTitle.trim()
        ? normalizeChapterBody(parsed.chapterTitle).slice(0, 180)
        : `Chapter ${chapterNumber}`;

    const chapterBody =
      typeof parsed.chapterBody === "string" && parsed.chapterBody.trim()
        ? normalizeChapterBody(parsed.chapterBody)
        : normalizeChapterBody(raw);

    const parsedChoices = Array.isArray(parsed.choices)
      ? parsed.choices
          .filter((item): item is string => typeof item === "string")
          .map((item) => normalizeChoice(item))
          .filter(Boolean)
          .slice(0, 3)
      : [];

    const choiceOptions = finalizeChoiceOptions(parsedChoices, chapterNumber, {
      ...context,
      chapterTitle,
      chapterBody,
    });

    return {
      chapterTitle,
      chapterBody,
      choiceOptions,
      didParseJson: true,
    } satisfies ParsedChapterOutput;
  }

  const recovered = tryRecoverMalformedJsonOutput(raw, chapterNumber, context);

  if (recovered) {
    return recovered;
  }

  const fallbackChapterBody = normalizeChapterBody(stripCodeContainer(raw));

  return {
    chapterTitle: `Chapter ${chapterNumber}`,
    chapterBody: fallbackChapterBody,
    choiceOptions: finalizeChoiceOptions([], chapterNumber, {
      ...context,
      chapterTitle: context?.chapterTitle || `Chapter ${chapterNumber}`,
      chapterBody: fallbackChapterBody || context?.chapterBody,
    }),
    didParseJson: false,
  } satisfies ParsedChapterOutput;
}

function tryParseViewpointJsonObject(raw: string) {
  const cleaned = stripCodeContainer(raw);
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = cleaned.slice(firstBrace, lastBrace + 1);

    if (sliced !== cleaned) {
      candidates.push(sliced);
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as {
          viewpointTitle?: unknown;
          viewpointBody?: unknown;
          chapterTitle?: unknown;
          chapterBody?: unknown;
          title?: unknown;
          content?: unknown;
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseViewpointOutput(raw: string, fallbackTitle: string): ParsedViewpointOutput {
  const parsed = tryParseViewpointJsonObject(raw);

  if (parsed) {
    const parsedTitleCandidates = [
      parsed.viewpointTitle,
      parsed.chapterTitle,
      parsed.title,
    ];
    const parsedBodyCandidates = [
      parsed.viewpointBody,
      parsed.chapterBody,
      parsed.content,
    ];

    const viewpointTitle = parsedTitleCandidates
      .find((item): item is string => typeof item === "string" && item.trim().length > 0)
      ?.trim()
      .slice(0, 180);
    const viewpointBody = parsedBodyCandidates
      .find((item): item is string => typeof item === "string" && item.trim().length > 0);

    if (viewpointBody) {
      return {
        viewpointTitle: viewpointTitle || fallbackTitle,
        viewpointBody: normalizeChapterBody(viewpointBody),
        didParseJson: true,
      };
    }
  }

  return {
    viewpointTitle: fallbackTitle,
    viewpointBody: normalizeChapterBody(stripCodeContainer(raw)),
    didParseJson: false,
  };
}

function buildChapterViewpointPrompt(options: {
  detail: ReaderSessionDetail;
  chapter: ReaderChapter;
  characterName: string;
  lens: ReaderChapterViewpointLens;
  directionInput: string | null;
  profile: ViewpointGenerationProfile;
}) {
  return [
    "You are the InkBranch alternate-viewpoint writer.",
    "Rewrite the selected chapter from one character's perspective.",
    "Keep canon alignment with the source chapter.",
    "You may reveal private motives and hidden observations from that character's POV.",
    "Return valid JSON only, with no markdown fences.",
    "",
    "JSON schema:",
    '{"viewpointTitle":"string","viewpointBody":"string"}',
    "",
    `Book title: ${options.detail.libraryBook.title}`,
    options.detail.libraryBook.premise
      ? `Book premise: ${options.detail.libraryBook.premise}`
      : null,
    `Source chapter number: ${options.chapter.chapterNumber}`,
    `Source chapter title: ${options.chapter.title}`,
    `Target character viewpoint: ${options.characterName}`,
    `Lens: ${options.lens} (${options.profile.lensLabel})`,
    options.directionInput
      ? `Reader viewpoint direction: ${options.directionInput}`
      : "Reader viewpoint direction: none",
    "",
    options.detail.rules.canon.length ? "Canon anchors:" : null,
    ...(options.detail.rules.canon.length
      ? options.detail.rules.canon.map((rule) => `- ${rule}`)
      : []),
    "",
    "Source chapter text:",
    options.chapter.content,
    "",
    "Requirements:",
    `- viewpointBody must be ${options.profile.targetWordsMin} to ${options.profile.targetWordsMax} words.`,
    "- Use a clear perspective voice rooted in the selected character.",
    "- Preserve the chapter's major external events and outcomes.",
    "- Preserve concrete continuity details (location, timing, injuries, props, and unresolved actions).",
    "- Add insight, emotion, and subtext unavailable in the original narration.",
    "- Do not introduce canon-breaking twists.",
    options.lens === "SPINOFF"
      ? "- End with unresolved momentum that could naturally seed a future standalone story."
      : "- End with a satisfying emotional beat tied to this chapter's events.",
    "- Avoid bullet points. Write prose paragraphs.",
    "- Do not include markdown fences, HTML tags, or commentary outside JSON.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildChapterViewpointExpansionPrompt(options: {
  chapter: ReaderChapter;
  characterName: string;
  lens: ReaderChapterViewpointLens;
  directionInput: string | null;
  profile: ViewpointGenerationProfile;
  currentTitle: string;
  currentBody: string;
}) {
  return [
    "Expand and strengthen this alternate viewpoint draft while keeping canon consistency.",
    "Return valid JSON only, with no markdown fences.",
    "JSON schema:",
    '{"viewpointTitle":"string","viewpointBody":"string"}',
    "",
    `Source chapter number: ${options.chapter.chapterNumber}`,
    `Source chapter title: ${options.chapter.title}`,
    `Target character: ${options.characterName}`,
    `Lens: ${options.lens} (${options.profile.lensLabel})`,
    options.directionInput
      ? `Reader viewpoint direction: ${options.directionInput}`
      : "Reader viewpoint direction: none",
    "",
    `Current viewpoint title: ${options.currentTitle}`,
    "Current viewpoint body:",
    options.currentBody,
    "",
    "Source chapter text for alignment:",
    summarizeForPrompt(options.chapter.content, 2600),
    "",
    "Requirements:",
    `- Expand viewpointBody to ${options.profile.targetWordsMin} to ${options.profile.targetWordsMax} words.`,
    "- Keep major chapter outcomes aligned with the source.",
    "- Keep concrete continuity details aligned with the source chapter's reality.",
    "- Deepen interiority and character-specific interpretation.",
    "- Keep prose quality high and avoid repetitive filler.",
    options.lens === "SPINOFF"
      ? "- Leave one strong unresolved thread that could launch a larger spinoff arc."
      : "- Close with a coherent emotional and narrative beat.",
    "- Do not include markdown fences, HTML tags, or commentary outside JSON.",
  ].join("\n");
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
        worlds.chapter_cap,
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

export async function listBookstoreBooks(user: PublicUser): Promise<BookstoreBook[]> {
  const db = await getDatabase();
  const result = await db.query<BookstoreBookRow>(
    `
      SELECT
        worlds.id,
        worlds.title,
        worlds.slug,
        worlds.premise,
        worlds.status,
        authors.name AS author_name,
        authors.email AS author_email,
        CASE WHEN lb.id IS NULL THEN FALSE ELSE TRUE END AS in_library
      FROM story_worlds AS worlds
      JOIN users AS authors
        ON authors.id = worlds.author_id
      LEFT JOIN library_books AS lb
        ON lb.world_id = worlds.id
       AND lb.user_id = $2
      WHERE (
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
    inLibrary: row.in_library,
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

export async function recordReaderActivity(options: {
  user: PublicUser;
  sessionId: string;
  secondsSpent: number;
}) {
  const sessionId = options.sessionId.trim();

  if (!sessionId) {
    throw new Error("sessionId is required.");
  }

  const parsedSeconds = Math.floor(options.secondsSpent);

  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
    throw new Error("secondsSpent must be a positive number.");
  }

  const boundedSeconds = Math.min(
    parsedSeconds,
    MAX_READING_ACTIVITY_SECONDS_PER_UPDATE,
  );
  const db = await getDatabase();
  const result = await db.query<{ id: string }>(
    `
      UPDATE story_sessions
      SET reading_seconds = COALESCE(reading_seconds, 0) + $3
      WHERE id = $1
        AND reader_id = $2
        AND status = 'ACTIVE'
      RETURNING id
    `,
    [sessionId, options.user.id, boundedSeconds],
  );

  if (!result.rows[0]) {
    throw new Error("Reading session not found.");
  }
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
        worlds.chapter_cap AS world_chapter_cap,
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

  const chapterIds = chaptersResult.rows.map((chapter) => chapter.id);
  const viewpointsResult = chapterIds.length
    ? await db.query<ViewpointRow>(
        `
          SELECT
            viewpoints.id,
            viewpoints.chapter_id,
            chapters.turn_index AS chapter_number,
            viewpoints.character_name,
            viewpoints.lens,
            viewpoints.direction_input,
            viewpoints.viewpoint_title,
            viewpoints.ai_response,
            viewpoints.model,
            viewpoints.created_at
          FROM chapter_viewpoints AS viewpoints
          JOIN story_turns AS chapters
            ON chapters.id = viewpoints.chapter_id
          WHERE viewpoints.chapter_id = ANY($1::text[])
          ORDER BY chapters.turn_index ASC, viewpoints.created_at ASC
        `,
        [chapterIds],
      )
    : { rows: [] as ViewpointRow[] };

  const viewpointsByChapterId = new Map<string, ReaderChapterViewpoint[]>();

  for (const row of viewpointsResult.rows) {
    const current = viewpointsByChapterId.get(row.chapter_id) ?? [];
    current.push(toReaderChapterViewpoint(row));
    viewpointsByChapterId.set(row.chapter_id, current);
  }

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
    const parsedOutput = parseChapterOutput(chapter.ai_response, chapterNumber, {
      chapterTitle: chapter.chapter_title || undefined,
      directionInput: chapter.reader_input,
    });
    const storedChoiceOptions = safeParseChoiceOptions(chapter.choice_options);
    const choiceOptions = finalizeChoiceOptions(
      storedChoiceOptions.length >= 3 ? storedChoiceOptions : parsedOutput.choiceOptions,
      chapterNumber,
      {
        chapterTitle: parsedOutput.chapterTitle || chapter.chapter_title || undefined,
        chapterBody: parsedOutput.chapterBody,
        directionInput: chapter.reader_input,
      },
    );
    const fallbackTitle = parsedOutput.chapterTitle || `Chapter ${chapterNumber}`;
    const chapterViewpoints = viewpointsByChapterId.get(chapter.id) ?? [];
    const characterCandidates = mergeDistinctCharacterNames(
      listCharacterCandidatesFromChapter(
        chapter.chapter_title?.trim() || fallbackTitle,
        parsedOutput.chapterBody,
      ),
      chapterViewpoints.map((viewpoint) => viewpoint.characterName),
    );

    return {
      id: chapter.id,
      chapterNumber,
      title: chapter.chapter_title?.trim() || fallbackTitle,
      content: parsedOutput.chapterBody,
      characterCandidates,
      viewpoints: chapterViewpoints,
      directionInput: chapter.reader_input,
      choiceOptions,
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
    chapterCap: toNullableNumber(core.world_chapter_cap),
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
      characterCandidates: listCharacterCandidatesFromChapter(
        fallbackTitle,
        options.chapterBody,
      ),
      viewpoints: [],
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

async function insertChapterViewpoint(options: {
  sessionId: string;
  chapter: ReaderChapter;
  characterName: string;
  lens: ReaderChapterViewpointLens;
  directionInput: string | null;
  viewpointTitle: string;
  viewpointBody: string;
  model: string;
}) {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  const viewpointId = randomUUID();

  await db.query("BEGIN");

  try {
    const chapterResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM story_turns
        WHERE id = $1
          AND session_id = $2
        LIMIT 1
        FOR UPDATE
      `,
      [options.chapter.id, options.sessionId],
    );

    if (!chapterResult.rows[0]) {
      throw new Error("Chapter not found in this session.");
    }

    const existingViewpointsResult = await db.query<{ character_name: string }>(
      `
        SELECT character_name
        FROM chapter_viewpoints
        WHERE chapter_id = $1
      `,
      [options.chapter.id],
    );
    const requestedCharacterKey = toCharacterIdentityKey(options.characterName);
    const conflictingViewpoint = existingViewpointsResult.rows.find(
      (row) => toCharacterIdentityKey(row.character_name) === requestedCharacterKey,
    );

    if (conflictingViewpoint) {
      throw new Error(
        `A viewpoint for ${conflictingViewpoint.character_name} already exists in this chapter. Choose a different character.`,
      );
    }

    await db.query(
      `
        INSERT INTO chapter_viewpoints (
          id,
          chapter_id,
          character_name,
          lens,
          direction_input,
          viewpoint_title,
          ai_response,
          model,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        viewpointId,
        options.chapter.id,
        options.characterName,
        options.lens,
        options.directionInput,
        options.viewpointTitle,
        options.viewpointBody,
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
      viewpoint: {
        id: viewpointId,
        chapterId: options.chapter.id,
        chapterNumber: options.chapter.chapterNumber,
        characterName: options.characterName,
        lens: options.lens,
        title: options.viewpointTitle,
        content: options.viewpointBody,
        directionInput: options.directionInput,
        model: options.model,
        createdAt: nowIso,
      } satisfies ReaderChapterViewpoint,
      sessionUpdatedAt: nowIso,
    };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function generateChapterViewpoint(options: {
  user: PublicUser;
  sessionId: string;
  chapterId: string;
  characterName: string;
  lens?: ReaderChapterViewpointLens;
  directionInput?: string;
  model?: string;
}) {
  const sessionId = options.sessionId.trim();
  const chapterId = options.chapterId.trim();
  const characterName = normalizeViewpointCharacterName(options.characterName);

  if (!sessionId) {
    throw new Error("sessionId is required.");
  }

  if (!chapterId) {
    throw new Error("chapterId is required.");
  }

  if (!characterName) {
    throw new Error("characterName is required.");
  }

  const directionInput = normalizeOptionalText(options.directionInput);

  if (
    directionInput &&
    directionInput.length > MAX_VIEWPOINT_DIRECTION_LENGTH
  ) {
    throw new Error(
      `directionInput must be ${MAX_VIEWPOINT_DIRECTION_LENGTH} characters or less.`,
    );
  }

  const detail = await getReaderSessionDetail(options.user, sessionId);

  if (!detail) {
    throw new Error("Reading session not found.");
  }

  const chapter = detail.chapters.find((item) => item.id === chapterId);

  if (!chapter) {
    throw new Error("Chapter not found in this session.");
  }

  const requestedCharacterKey = toCharacterIdentityKey(characterName);
  const existingViewpoint = chapter.viewpoints.find(
    (viewpoint) => toCharacterIdentityKey(viewpoint.characterName) === requestedCharacterKey,
  );

  if (existingViewpoint) {
    throw new Error(
      `A viewpoint for ${existingViewpoint.characterName} already exists in this chapter. Choose a different character.`,
    );
  }

  const lens = toViewpointLens(options.lens);
  const profile = VIEWPOINT_GENERATION_PROFILES[lens];
  const fallbackTitle = `Chapter ${chapter.chapterNumber} - ${characterName}'s View`;
  let parsed: ParsedViewpointOutput = {
    viewpointTitle: fallbackTitle,
    viewpointBody: "",
    didParseJson: false,
  };
  let modelUsed = options.model ?? "";

  for (
    let attempt = 1;
    attempt <= VIEWPOINT_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const prompt =
      attempt === 1
        ? buildChapterViewpointPrompt({
            detail,
            chapter,
            characterName,
            lens,
            directionInput,
            profile,
          })
        : buildChapterViewpointExpansionPrompt({
            chapter,
            characterName,
            lens,
            directionInput,
            profile,
            currentTitle: parsed.viewpointTitle,
            currentBody: parsed.viewpointBody,
          });

    const generated = await generateStoryText({
      prompt,
      model: options.model,
      maxOutputTokens: profile.maxOutputTokens,
      temperature: profile.temperature,
    });

    parsed = parseViewpointOutput(generated.text, fallbackTitle);
    modelUsed = generated.model;

    if (countWords(parsed.viewpointBody) >= profile.minAcceptedWords) {
      break;
    }
  }

  const viewpointWordCount = countWords(parsed.viewpointBody);

  if (viewpointWordCount < profile.minAcceptedWords) {
    throw new Error(
      `Viewpoint generation returned only ${viewpointWordCount} words (minimum ${profile.minAcceptedWords}). Please try again.`,
    );
  }

  const persisted = await insertChapterViewpoint({
    sessionId,
    chapter,
    characterName,
    lens,
    directionInput,
    viewpointTitle: parsed.viewpointTitle || fallbackTitle,
    viewpointBody: parsed.viewpointBody,
    model: modelUsed || "unknown-model",
  });

  return persisted;
}

async function markSessionCompleted(sessionId: string) {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();

  await db.query(
    `
      UPDATE story_sessions
      SET
        status = 'COMPLETED',
        completed_at = COALESCE(completed_at, $2),
        updated_at = $2
      WHERE id = $1
        AND status = 'ACTIVE'
    `,
    [sessionId, nowIso],
  );
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
    const firstDirection =
      "Open chapter 1 with grounded character context, vivid atmosphere, and steadily building momentum.";
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

  const chapterCap = detail.libraryBook.chapterCap;
  const generationProfile = resolveChapterGenerationProfile();
  const minimumAcceptedWords = resolveMinimumAcceptedChapterWords(generationProfile);
  const overusedCharacterNames = await listOverusedCharacterNamesForReader({
    readerId: options.user.id,
    currentWorldId: detail.libraryBook.worldId,
  });

  if (chapterCap && detail.chapters.length >= chapterCap) {
    await markSessionCompleted(options.sessionId);
    throw new Error(
      `This book has reached its chapter cap of ${chapterCap} chapters. Session completed.`,
    );
  }

  const chapterNumber = detail.chapters.length + 1;
  let parsed = {
    chapterTitle: `Chapter ${chapterNumber}`,
    chapterBody: "",
    choiceOptions: buildFallbackChoices(chapterNumber),
  };
  let modelUsed = options.model ?? "";
  let chapterWordCount = 0;

  for (
    let attempt = 1;
    attempt <= generationProfile.generationAttempts;
    attempt += 1
  ) {
    const prompt =
      attempt === 1
        ? buildChapterPrompt(
            detail,
            chapterNumber,
            direction,
            generationProfile,
            overusedCharacterNames,
          )
        : buildChapterExpansionPrompt({
            chapterNumber,
            directionInput: direction,
            currentTitle: parsed.chapterTitle,
            currentBody: parsed.chapterBody,
            currentChoices: parsed.choiceOptions,
            profile: generationProfile,
            overusedCharacterNames,
          });

    const generated = await generateStoryText({
      prompt,
      model: options.model,
      maxOutputTokens: generationProfile.maxOutputTokens,
      temperature: generationProfile.temperature,
    });

    parsed = parseChapterOutput(generated.text, chapterNumber, {
      directionInput: direction,
    });
    modelUsed = generated.model;
    chapterWordCount = countWords(parsed.chapterBody);

    if (
      chapterWordCount >= generationProfile.targetWordsMin &&
      !hasLikelyAbruptEnding(parsed.chapterBody)
    ) {
      break;
    }
  }

  for (
    let rescueAttempt = 1;
    rescueAttempt <= SHORT_CHAPTER_RECOVERY_ATTEMPTS;
    rescueAttempt += 1
  ) {
    const stillTooShort = chapterWordCount < generationProfile.targetWordsMin;
    const likelyCutOff = hasLikelyAbruptEnding(parsed.chapterBody);

    if (!stillTooShort && !likelyCutOff) {
      break;
    }

    const rescue = await generateStoryText({
      prompt: buildChapterExpansionPrompt({
        chapterNumber,
        directionInput: direction,
        currentTitle: parsed.chapterTitle,
        currentBody: parsed.chapterBody,
        currentChoices: parsed.choiceOptions,
        profile: generationProfile,
        overusedCharacterNames,
      }),
      model: options.model,
      maxOutputTokens: generationProfile.maxOutputTokens + 800,
      temperature: generationProfile.temperature,
    });

    parsed = parseChapterOutput(rescue.text, chapterNumber, {
      chapterTitle: parsed.chapterTitle,
      chapterBody: parsed.chapterBody,
      directionInput: direction,
    });
    modelUsed = rescue.model;
    chapterWordCount = countWords(parsed.chapterBody);
  }

  if (CHAPTER_CONTINUITY_REVIEW_ENABLED && detail.chapters.length > 0) {
    const previousChapter = detail.chapters[detail.chapters.length - 1];

    const reviewed = await generateStoryText({
      prompt: buildChapterContinuityRevisionPrompt({
        previousChapter,
        chapterNumber,
        directionInput: direction,
        chapterTitle: parsed.chapterTitle,
        chapterBody: parsed.chapterBody,
        profile: generationProfile,
      }),
      model: options.model,
      maxOutputTokens: generationProfile.maxOutputTokens + 900,
      temperature: 0.45,
    });

    const revised = parseChapterContinuityRevisionOutput(
      reviewed.text,
      parsed.chapterTitle,
      parsed.chapterBody,
    );

    if (revised.didParseJson) {
      parsed.chapterTitle = revised.chapterTitle;
      parsed.chapterBody = revised.chapterBody;
      modelUsed = reviewed.model;
      chapterWordCount = countWords(parsed.chapterBody);
    }
  }

  if (chapterWordCount < minimumAcceptedWords) {
    throw new Error(
      `Chapter generation returned only ${chapterWordCount} words (minimum ${minimumAcceptedWords}). Please try again.`,
    );
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
