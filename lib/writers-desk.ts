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
  chapterCap: number | null;
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

export type WriterDeskWorldDetail = WriterDeskWorld & {
  arcStatement: string | null;
  toneGuide: string | null;
  narrativeBoundaries: string | null;
  guardrailInstruction: string | null;
  canonRules: string[];
  characterTruthRules: string[];
  requiredEventRules: string[];
  outcomeRules: string[];
};

type WorldBlueprintCoreInput = {
  title: string;
  slug?: string;
  premise?: string;
  chapterCap?: number | null;
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

export type CreateWorldInput = WorldBlueprintCoreInput & {
  authorId: string;
};

export type UpdateWorldInput = WorldBlueprintCoreInput & {
  authorId: string;
  worldId: string;
};

type WorldListRow = {
  id: string;
  title: string;
  slug: string;
  status: WorldStatus;
  premise: string | null;
  chapter_cap: number | string | null;
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

type WorldCoreRow = {
  id: string;
  title: string;
  slug: string;
  status: WorldStatus;
  premise: string | null;
  chapter_cap: number | string | null;
  reader_agency: string | null;
  ai_directive: string | null;
  updated_at: Date | string;
  active_spine_id: string | null;
  active_spine_version: number | string | null;
  arc_statement: string | null;
  tone_guide: string | null;
  narrative_boundaries: string | null;
  guardrail_instruction: string | null;
};

type WorldRuleRow = {
  rule_type: RuleType;
  title: string;
  description: string;
};

const MAX_SLUG_ATTEMPTS = 200;

function toNullableText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNullableChapterCap(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return Number.isFinite(value) ? Math.trunc(value) : null;
}

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

  const numberValue = toNumber(value);
  return Number.isFinite(numberValue) ? numberValue : null;
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

function toRuleEditorLine(title: string, description: string) {
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedDescription || normalizedDescription === normalizedTitle) {
    return normalizedTitle;
  }

  return `${normalizedTitle}: ${normalizedDescription}`;
}

function mapWorldListRow(row: WorldListRow): WriterDeskWorld {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    premise: row.premise,
    chapterCap: toNullableNumber(row.chapter_cap),
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
  };
}

async function resolveUniqueSlug(
  preferredSlug: string,
  title: string,
  options?: { excludeWorldId?: string | null },
) {
  const db = await getDatabase();
  const fallback = slugify(title);
  const baseSlug = preferredSlug || fallback || `world-${randomUUID().slice(0, 8)}`;
  const excludeWorldId = options?.excludeWorldId?.trim() || null;

  for (let index = 0; index < MAX_SLUG_ATTEMPTS; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const result = await db.query<{ id: string }>(
      `
        SELECT id
        FROM story_worlds
        WHERE slug = $1
          AND ($2::text IS NULL OR id <> $2::text)
        LIMIT 1
      `,
      [candidate, excludeWorldId],
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

async function getAuthorWorldSummary(authorId: string, worldId: string) {
  const worlds = await listAuthorWorlds(authorId);
  return worlds.find((world) => world.id === worldId) ?? null;
}

async function getAuthorWorldCore(authorId: string, worldId: string) {
  const db = await getDatabase();
  const result = await db.query<WorldCoreRow>(
    `
      SELECT
        worlds.id,
        worlds.title,
        worlds.slug,
        worlds.status,
        worlds.premise,
        worlds.chapter_cap,
        worlds.reader_agency,
        worlds.ai_directive,
        worlds.updated_at,
        spine.id AS active_spine_id,
        spine.version AS active_spine_version,
        spine.arc_statement,
        spine.tone_guide,
        spine.narrative_boundaries,
        spine.guardrail_instruction
      FROM story_worlds AS worlds
      LEFT JOIN world_spine_versions AS spine
        ON spine.world_id = worlds.id
       AND spine.is_active = TRUE
      WHERE worlds.id = $1
        AND worlds.author_id = $2
      LIMIT 1
    `,
    [worldId, authorId],
  );

  return result.rows[0] ?? null;
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
        worlds.chapter_cap,
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
        worlds.chapter_cap,
        worlds.reader_agency,
        worlds.ai_directive,
        worlds.updated_at,
        spine.version
      ORDER BY worlds.updated_at DESC
    `,
    [authorId],
  );

  return result.rows.map(mapWorldListRow);
}

export async function getAuthorWorldDetail(
  authorId: string,
  worldId: string,
): Promise<WriterDeskWorldDetail | null> {
  const core = await getAuthorWorldCore(authorId, worldId);

  if (!core) {
    return null;
  }

  const db = await getDatabase();
  const rulesResult = core.active_spine_id
    ? await db.query<WorldRuleRow>(
        `
          SELECT rule_type, title, description
          FROM world_rules
          WHERE spine_version_id = $1
          ORDER BY rule_type ASC, sort_order ASC
        `,
        [core.active_spine_id],
      )
    : { rows: [] as WorldRuleRow[] };

  const summary = await getAuthorWorldSummary(authorId, worldId);

  if (!summary) {
    return null;
  }

  const detail: WriterDeskWorldDetail = {
    ...summary,
    arcStatement: core.arc_statement,
    toneGuide: core.tone_guide,
    narrativeBoundaries: core.narrative_boundaries,
    guardrailInstruction: core.guardrail_instruction,
    canonRules: [],
    characterTruthRules: [],
    requiredEventRules: [],
    outcomeRules: [],
  };

  for (const rule of rulesResult.rows) {
    const line = toRuleEditorLine(rule.title, rule.description);

    switch (rule.rule_type) {
      case "CANON":
        detail.canonRules.push(line);
        break;
      case "CHARACTER_TRUTH":
        detail.characterTruthRules.push(line);
        break;
      case "REQUIRED_EVENT":
        detail.requiredEventRules.push(line);
        break;
      case "OUTCOME":
        detail.outcomeRules.push(line);
        break;
    }
  }

  return detail;
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
          chapter_cap,
          reader_agency,
          ai_directive,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        worldId,
        input.authorId,
        input.title.trim(),
        slug,
        toNullableText(input.premise),
        toNullableChapterCap(input.chapterCap),
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

  const createdWorld = await getAuthorWorldSummary(input.authorId, worldId);

  if (!createdWorld) {
    throw new Error("World draft was created, but the response could not be loaded.");
  }

  return createdWorld;
}

export async function updateWorldBlueprint(input: UpdateWorldInput): Promise<WriterDeskWorld> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  const core = await getAuthorWorldCore(input.authorId, input.worldId);

  if (!core) {
    throw new Error("World not found.");
  }

  if (!core.active_spine_id) {
    throw new Error("This world does not have an active spine to edit.");
  }

  const slug = await resolveUniqueSlug(slugify(input.slug ?? ""), input.title, {
    excludeWorldId: input.worldId,
  });

  await db.query("BEGIN");

  try {
    await db.query(
      `
        UPDATE story_worlds
        SET
          title = $3,
          slug = $4,
          premise = $5,
          chapter_cap = $6,
          reader_agency = $7,
          ai_directive = $8,
          updated_at = $9
        WHERE id = $1
          AND author_id = $2
      `,
      [
        input.worldId,
        input.authorId,
        input.title.trim(),
        slug,
        toNullableText(input.premise),
        toNullableChapterCap(input.chapterCap),
        toNullableText(input.readerAgency),
        toNullableText(input.aiDirective),
        nowIso,
      ],
    );

    await db.query(
      `
        UPDATE world_spine_versions
        SET
          arc_statement = $2,
          tone_guide = $3,
          narrative_boundaries = $4,
          guardrail_instruction = $5,
          updated_at = $6
        WHERE id = $1
      `,
      [
        core.active_spine_id,
        toNullableText(input.arcStatement),
        toNullableText(input.toneGuide),
        toNullableText(input.narrativeBoundaries),
        toNullableText(input.guardrailInstruction),
        nowIso,
      ],
    );

    await db.query(
      `
        DELETE FROM world_rules
        WHERE spine_version_id = $1
      `,
      [core.active_spine_id],
    );

    await insertRules({
      db,
      spineVersionId: core.active_spine_id,
      ruleType: "CANON",
      rules: input.canonRules,
    });
    await insertRules({
      db,
      spineVersionId: core.active_spine_id,
      ruleType: "CHARACTER_TRUTH",
      rules: input.characterTruthRules,
    });
    await insertRules({
      db,
      spineVersionId: core.active_spine_id,
      ruleType: "REQUIRED_EVENT",
      rules: input.requiredEventRules,
    });
    await insertRules({
      db,
      spineVersionId: core.active_spine_id,
      ruleType: "OUTCOME",
      rules: input.outcomeRules,
    });

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }

  const updatedWorld = await getAuthorWorldSummary(input.authorId, input.worldId);

  if (!updatedWorld) {
    throw new Error("World was updated, but the response could not be loaded.");
  }

  return updatedWorld;
}

export async function publishWorld(authorId: string, worldId: string): Promise<WriterDeskWorld> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();

  const result = await db.query<{ id: string }>(
    `
      UPDATE story_worlds
      SET
        status = 'PUBLISHED',
        updated_at = $3
      WHERE id = $1
        AND author_id = $2
      RETURNING id
    `,
    [worldId, authorId, nowIso],
  );

  if (!result.rows[0]) {
    throw new Error("World not found.");
  }

  const publishedWorld = await getAuthorWorldSummary(authorId, worldId);

  if (!publishedWorld) {
    throw new Error("World was published, but the response could not be loaded.");
  }

  return publishedWorld;
}
