import { randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/db";

export type WorldStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type RuleType = "CANON" | "CHARACTER_TRUTH" | "REQUIRED_EVENT" | "OUTCOME";
export type RuleStrength = "HARD" | "SOFT";

export type WriterDeskWorld = {
  id: string;
  title: string;
  slug: string;
  status: WorldStatus;
  premise: string | null;
  readerAgency: string | null;
  aiDirective: string | null;
  updatedAt: string;
  activeSpineVersion: number;
  ruleCounts: {
    total: number;
    canon: number;
    characterTruths: number;
    requiredEvents: number;
    outcomes: number;
  };
};

export type CreateWorldInput = {
  authorId: string;
  title: string;
  slug?: string;
  premise?: string;
  readerAgency?: string;
  aiDirective?: string;
  arcStatement?: string;
  toneGuide?: string;
  narrativeBoundaries?: string;
  guardrailInstruction?: string;
  canonRules: string[];
  characterTruthRules: string[];
  requiredEventRules: string[];
  outcomeRules: string[];
};

type WorldListRow = {
  id: string;
  title: string;
  slug: string;
  status: WorldStatus;
  premise: string | null;
  reader_agency: string | null;
  ai_directive: string | null;
  updated_at: Date | string;
  active_spine_version: number | string;
  canon_count: number | string;
  character_truth_count: number | string;
  required_event_count: number | string;
  outcome_count: number | string;
  total_rule_count: number | string;
};

const MAX_SLUG_ATTEMPTS = 200;

function toNullableText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveRuleParts(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const colonIndex = trimmed.indexOf(":");

  if (colonIndex > 0) {
    const maybeTitle = trimmed.slice(0, colonIndex).trim();
    const maybeDescription = trimmed.slice(colonIndex + 1).trim();

    if (maybeTitle && maybeDescription) {
      return {
        title: maybeTitle.slice(0, 120),
        description: maybeDescription.slice(0, 3000),
      };
    }
  }

  return {
    title: trimmed.slice(0, 120),
    description: trimmed.slice(0, 3000),
  };
}

async function resolveUniqueSlug(preferredSlug: string, title: string) {
  const db = await getDatabase();
  const fallback = slugify(title);
  const baseSlug = preferredSlug || fallback || `world-${randomUUID().slice(0, 8)}`;

  for (let index = 0; index < MAX_SLUG_ATTEMPTS; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const result = await db.query<{ id: string }>(
      `
        SELECT id
        FROM story_worlds
        WHERE slug = $1
        LIMIT 1
      `,
      [candidate],
    );

    if (!result.rows[0]) {
      return candidate;
    }
  }

  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

async function insertRules(options: {
  spineVersionId: string;
  rules: string[];
  ruleType: RuleType;
  db: Awaited<ReturnType<typeof getDatabase>>;
}) {
  const nowIso = new Date().toISOString();

  const parsed = options.rules
    .map((rule) => resolveRuleParts(rule))
    .filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));

  for (let index = 0; index < parsed.length; index += 1) {
    const rule = parsed[index];

    await options.db.query(
      `
        INSERT INTO world_rules (
          id,
          spine_version_id,
          rule_type,
          strength,
          title,
          description,
          sort_order,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        options.spineVersionId,
        options.ruleType,
        "HARD" satisfies RuleStrength,
        rule.title,
        rule.description,
        index + 1,
        nowIso,
        nowIso,
      ],
    );
  }
}

export async function listAuthorWorlds(authorId: string): Promise<WriterDeskWorld[]> {
  const db = await getDatabase();
  const result = await db.query<WorldListRow>(
    `
      SELECT
        worlds.id,
        worlds.title,
        worlds.slug,
        worlds.status,
        worlds.premise,
        worlds.reader_agency,
        worlds.ai_directive,
        worlds.updated_at,
        COALESCE(spine.version, 1) AS active_spine_version,
        COALESCE(SUM(CASE WHEN rules.rule_type = 'CANON' THEN 1 ELSE 0 END), 0) AS canon_count,
        COALESCE(SUM(CASE WHEN rules.rule_type = 'CHARACTER_TRUTH' THEN 1 ELSE 0 END), 0) AS character_truth_count,
        COALESCE(SUM(CASE WHEN rules.rule_type = 'REQUIRED_EVENT' THEN 1 ELSE 0 END), 0) AS required_event_count,
        COALESCE(SUM(CASE WHEN rules.rule_type = 'OUTCOME' THEN 1 ELSE 0 END), 0) AS outcome_count,
        COALESCE(COUNT(rules.id), 0) AS total_rule_count
      FROM story_worlds AS worlds
      LEFT JOIN world_spine_versions AS spine
        ON spine.world_id = worlds.id
       AND spine.is_active = TRUE
      LEFT JOIN world_rules AS rules
        ON rules.spine_version_id = spine.id
      WHERE worlds.author_id = $1
      GROUP BY
        worlds.id,
        worlds.title,
        worlds.slug,
        worlds.status,
        worlds.premise,
        worlds.reader_agency,
        worlds.ai_directive,
        worlds.updated_at,
        spine.version
      ORDER BY worlds.updated_at DESC
    `,
    [authorId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    premise: row.premise,
    readerAgency: row.reader_agency,
    aiDirective: row.ai_directive,
    updatedAt: new Date(row.updated_at).toISOString(),
    activeSpineVersion: toNumber(row.active_spine_version),
    ruleCounts: {
      total: toNumber(row.total_rule_count),
      canon: toNumber(row.canon_count),
      characterTruths: toNumber(row.character_truth_count),
      requiredEvents: toNumber(row.required_event_count),
      outcomes: toNumber(row.outcome_count),
    },
  }));
}

export async function createWorldWithInitialSpine(
  input: CreateWorldInput,
): Promise<WriterDeskWorld> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  const slug = await resolveUniqueSlug(slugify(input.slug ?? ""), input.title);
  const worldId = randomUUID();
  const spineVersionId = randomUUID();

  await db.query("BEGIN");

  try {
    await db.query(
      `
        INSERT INTO story_worlds (
          id,
          author_id,
          title,
          slug,
          premise,
          reader_agency,
          ai_directive,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        worldId,
        input.authorId,
        input.title.trim(),
        slug,
        toNullableText(input.premise),
        toNullableText(input.readerAgency),
        toNullableText(input.aiDirective),
        "DRAFT" satisfies WorldStatus,
        nowIso,
        nowIso,
      ],
    );

    await db.query(
      `
        INSERT INTO world_spine_versions (
          id,
          world_id,
          version,
          is_active,
          arc_statement,
          tone_guide,
          narrative_boundaries,
          guardrail_instruction,
          created_by_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        spineVersionId,
        worldId,
        1,
        true,
        toNullableText(input.arcStatement),
        toNullableText(input.toneGuide),
        toNullableText(input.narrativeBoundaries),
        toNullableText(input.guardrailInstruction),
        input.authorId,
        nowIso,
        nowIso,
      ],
    );

    await insertRules({
      db,
      spineVersionId,
      ruleType: "CANON",
      rules: input.canonRules,
    });
    await insertRules({
      db,
      spineVersionId,
      ruleType: "CHARACTER_TRUTH",
      rules: input.characterTruthRules,
    });
    await insertRules({
      db,
      spineVersionId,
      ruleType: "REQUIRED_EVENT",
      rules: input.requiredEventRules,
    });
    await insertRules({
      db,
      spineVersionId,
      ruleType: "OUTCOME",
      rules: input.outcomeRules,
    });

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
      [randomUUID(), input.authorId, worldId, "AUTHOR_AUTO", nowIso],
    );

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }

  const [createdWorld] = await listAuthorWorlds(input.authorId).then((worlds) =>
    worlds.filter((world) => world.id === worldId),
  );

  if (!createdWorld) {
    throw new Error("World draft was created, but the response could not be loaded.");
  }

  return createdWorld;
}
