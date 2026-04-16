export type WorldBlueprintRequestBody = {
  title?: unknown;
  slug?: unknown;
  genre?: unknown;
  premise?: unknown;
  chapterCap?: unknown;
  readerAgency?: unknown;
  aiDirective?: unknown;
  arcStatement?: unknown;
  toneGuide?: unknown;
  narrativeBoundaries?: unknown;
  guardrailInstruction?: unknown;
  canonRules?: unknown;
  characterTruthRules?: unknown;
  requiredEventRules?: unknown;
  outcomeRules?: unknown;
};

export const MAX_TEXT_LENGTH = 3000;
export const MAX_RULE_COUNT_PER_TYPE = 40;
export const MAX_CHAPTER_CAP = 500;
export const MAX_GENRE_LENGTH = 80;

export class ValidationError extends Error {}

function readOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRuleList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function throwValidationError(message: string): never {
  throw new ValidationError(message);
}

function readChapterCap(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) {
      throwValidationError("Chapter cap must be a number.");
    }

    const normalized = Math.trunc(parsed);

    if (normalized < 1 || normalized > MAX_CHAPTER_CAP) {
      throwValidationError(`Chapter cap must be between 1 and ${MAX_CHAPTER_CAP}.`);
    }

    return normalized;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throwValidationError("Chapter cap must be a number.");
    }

    const normalized = Math.trunc(value);

    if (normalized < 1 || normalized > MAX_CHAPTER_CAP) {
      throwValidationError(`Chapter cap must be between 1 and ${MAX_CHAPTER_CAP}.`);
    }

    return normalized;
  }

  throwValidationError("Chapter cap must be a number.");
}

export function validateWorldBlueprintBody(raw: WorldBlueprintRequestBody) {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";

  if (title.length < 3) {
    throwValidationError("Title must be at least 3 characters.");
  }

  if (title.length > 120) {
    throwValidationError("Title must be 120 characters or less.");
  }

  const slug = readOptionalText(raw.slug);
  const genre = readOptionalText(raw.genre);

  if (slug.length > 80) {
    throwValidationError("Slug must be 80 characters or less.");
  }

  if (genre.length > MAX_GENRE_LENGTH) {
    throwValidationError(`Genre must be ${MAX_GENRE_LENGTH} characters or less.`);
  }

  const premise = readOptionalText(raw.premise);
  const chapterCap = readChapterCap(raw.chapterCap);
  const readerAgency = readOptionalText(raw.readerAgency);
  const aiDirective = readOptionalText(raw.aiDirective);
  const arcStatement = readOptionalText(raw.arcStatement);
  const toneGuide = readOptionalText(raw.toneGuide);
  const narrativeBoundaries = readOptionalText(raw.narrativeBoundaries);
  const guardrailInstruction = readOptionalText(raw.guardrailInstruction);

  const longField = [
    ["Premise", premise],
    ["Reader agency guidance", readerAgency],
    ["AI directive", aiDirective],
    ["Arc statement", arcStatement],
    ["Tone guide", toneGuide],
    ["Narrative boundaries", narrativeBoundaries],
    ["Guardrail instruction", guardrailInstruction],
  ].find(([, value]) => value.length > MAX_TEXT_LENGTH);

  if (longField) {
    throwValidationError(`${longField[0]} must be ${MAX_TEXT_LENGTH} characters or less.`);
  }

  const canonRules = readRuleList(raw.canonRules);
  const characterTruthRules = readRuleList(raw.characterTruthRules);
  const requiredEventRules = readRuleList(raw.requiredEventRules);
  const outcomeRules = readRuleList(raw.outcomeRules);

  const ruleSets = [
    ["Canon rules", canonRules],
    ["Character truths", characterTruthRules],
    ["Required events", requiredEventRules],
    ["Outcome constraints", outcomeRules],
  ] as const;

  for (const [label, rules] of ruleSets) {
    if (rules.length > MAX_RULE_COUNT_PER_TYPE) {
      throwValidationError(`${label} can include up to ${MAX_RULE_COUNT_PER_TYPE} items.`);
    }

    const tooLongRule = rules.find((rule) => rule.length > MAX_TEXT_LENGTH);

    if (tooLongRule) {
      throwValidationError(`${label} entries must be ${MAX_TEXT_LENGTH} characters or less.`);
    }
  }

  return {
    title,
    slug,
    genre,
    premise,
    chapterCap,
    readerAgency,
    aiDirective,
    arcStatement,
    toneGuide,
    narrativeBoundaries,
    guardrailInstruction,
    canonRules,
    characterTruthRules,
    requiredEventRules,
    outcomeRules,
  };
}
