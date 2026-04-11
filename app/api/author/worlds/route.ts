import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import {
  createWorldWithInitialSpine,
  listAuthorWorlds,
} from "@/lib/writers-desk";

export const runtime = "nodejs";

type CreateWorldRequestBody = {
  title?: unknown;
  slug?: unknown;
  premise?: unknown;
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

const MAX_TEXT_LENGTH = 3000;
const MAX_RULE_COUNT_PER_TYPE = 40;

class ValidationError extends Error {}

function canUseWritersDesk(role: string) {
  return role === "AUTHOR" || role === "ADMIN";
}

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

function validateCreateBody(raw: CreateWorldRequestBody) {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";

  if (title.length < 3) {
    throwValidationError("Title must be at least 3 characters.");
  }

  if (title.length > 120) {
    throwValidationError("Title must be 120 characters or less.");
  }

  const slug = readOptionalText(raw.slug);

  if (slug.length > 80) {
    throwValidationError("Slug must be 80 characters or less.");
  }

  const premise = readOptionalText(raw.premise);
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
    premise,
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

export async function GET() {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  const worlds = await listAuthorWorlds(user.id);

  return NextResponse.json({ worlds });
}

export async function POST(request: Request) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  let body: CreateWorldRequestBody;

  try {
    body = (await request.json()) as CreateWorldRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that world creation request." },
      { status: 400 },
    );
  }

  try {
    const input = validateCreateBody(body);
    const world = await createWorldWithInitialSpine({
      authorId: user.id,
      ...input,
    });

    return NextResponse.json({ world }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("World creation failed", error);

    return NextResponse.json(
      { error: "Could not create world draft." },
      { status: 500 },
    );
  }
}
