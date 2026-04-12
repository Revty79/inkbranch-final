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

type ParsedChapterOutput = {
  chapterTitle: string;
  chapterBody: string;
  choiceOptions: string[];
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

const MAX_DIRECTION_LENGTH = 2500;
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
const CHOICE_META_ARTIFACT_PATTERNS = [
  /\bopen chapter\s*\d+\b/i,
  /\bstrong hook\b/i,
  /\bclear momentum\b/i,
  /\bcontinue naturally(?: from the previous chapter)?\b/i,
  /\breader direction\b/i,
];

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

function buildChapterPrompt(
  detail: ReaderSessionDetail,
  chapterNumber: number,
  directionInput: string,
  profile: ChapterGenerationProfile,
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
    `- Expand chapterBody to ${options.profile.targetWordsMin} to ${options.profile.targetWordsMax} words.`,
    "- Ensure the expanded chapter feels like a full novel chapter, not a short scene.",
    "- Add meaningful progression, escalation, and consequence so chapter length feels earned.",
    "- Keep continuity and core events from the current draft.",
    "- Keep prose quality high and avoid repetition.",
    "- Return exactly 3 strong next-chapter choices.",
    "- Each choice must be 2-3 complete sentences and grounded in chapter stakes.",
    "- Choices should be roughly 16-110 words, specific, and actionable (no vague filler).",
    "- Do not wrap output in markdown fences or HTML tags such as <code>.",
  ].join("\n");
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

    return {
      id: chapter.id,
      chapterNumber,
      title: chapter.chapter_title?.trim() || fallbackTitle,
      content: parsedOutput.chapterBody,
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

  const chapterCap = detail.libraryBook.chapterCap;
  const generationProfile = resolveChapterGenerationProfile();
  const minimumAcceptedWords = resolveMinimumAcceptedChapterWords(generationProfile);

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
        ? buildChapterPrompt(detail, chapterNumber, direction, generationProfile)
        : buildChapterExpansionPrompt({
            chapterNumber,
            directionInput: direction,
            currentTitle: parsed.chapterTitle,
            currentBody: parsed.chapterBody,
            currentChoices: parsed.choiceOptions,
            profile: generationProfile,
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
