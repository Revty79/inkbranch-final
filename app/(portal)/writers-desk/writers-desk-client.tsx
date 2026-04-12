"use client";

import { FormEvent, useMemo, useState } from "react";

type WorldStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type DeskWorld = {
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

type DeskWorldDetail = DeskWorld & {
  arcStatement: string | null;
  toneGuide: string | null;
  narrativeBoundaries: string | null;
  guardrailInstruction: string | null;
  canonRules: string[];
  characterTruthRules: string[];
  requiredEventRules: string[];
  outcomeRules: string[];
};

type Message = {
  type: "success" | "error";
  text: string;
};

type Props = {
  initialWorlds: DeskWorld[];
};

function formatStatus(status: WorldStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function splitRules(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinRules(lines: string[]) {
  return lines.join("\n");
}

function getRulesBadgeLabel(totalRules: number) {
  return totalRules === 1 ? "1 rule" : `${totalRules} rules`;
}

function upsertWorld(worlds: DeskWorld[], world: DeskWorld) {
  const withoutCurrent = worlds.filter((item) => item.id !== world.id);
  return [world, ...withoutCurrent].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function WritersDeskClient({ initialWorlds }: Props) {
  const [worlds, setWorlds] = useState<DeskWorld[]>(initialWorlds);
  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [premise, setPremise] = useState("");
  const [chapterCapInput, setChapterCapInput] = useState("");
  const [readerAgency, setReaderAgency] = useState("");
  const [aiDirective, setAiDirective] = useState("");
  const [arcStatement, setArcStatement] = useState("");
  const [toneGuide, setToneGuide] = useState("");
  const [narrativeBoundaries, setNarrativeBoundaries] = useState("");
  const [guardrailInstruction, setGuardrailInstruction] = useState("");
  const [canonRulesInput, setCanonRulesInput] = useState("");
  const [characterTruthRulesInput, setCharacterTruthRulesInput] = useState("");
  const [requiredEventRulesInput, setRequiredEventRulesInput] = useState("");
  const [outcomeRulesInput, setOutcomeRulesInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [publishingWorldId, setPublishingWorldId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const sortedWorlds = useMemo(
    () => [...worlds].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [worlds],
  );

  function resetForm() {
    setEditingWorldId(null);
    setTitle("");
    setSlug("");
    setPremise("");
    setChapterCapInput("");
    setReaderAgency("");
    setAiDirective("");
    setArcStatement("");
    setToneGuide("");
    setNarrativeBoundaries("");
    setGuardrailInstruction("");
    setCanonRulesInput("");
    setCharacterTruthRulesInput("");
    setRequiredEventRulesInput("");
    setOutcomeRulesInput("");
  }

  async function handleCreateOrUpdateWorld(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);

    const chapterCap = chapterCapInput.trim() ? Number(chapterCapInput) : null;
    const method = editingWorldId ? "PUT" : "POST";
    const endpoint = editingWorldId
      ? `/api/author/worlds/${editingWorldId}`
      : "/api/author/worlds";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          slug,
          premise,
          chapterCap,
          readerAgency,
          aiDirective,
          arcStatement,
          toneGuide,
          narrativeBoundaries,
          guardrailInstruction,
          canonRules: splitRules(canonRulesInput),
          characterTruthRules: splitRules(characterTruthRulesInput),
          requiredEventRules: splitRules(requiredEventRulesInput),
          outcomeRules: splitRules(outcomeRulesInput),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { world?: DeskWorld; error?: string }
        | null;

      if (!response.ok || !payload?.world) {
        throw new Error(
          payload?.error ??
            (editingWorldId
              ? "Could not update world blueprint."
              : "Could not create world draft."),
        );
      }

      const savedWorld = payload.world;
      setWorlds((current) => upsertWorld(current, savedWorld));
      resetForm();
      setMessage({
        type: "success",
        text: editingWorldId
          ? `World \"${savedWorld.title}\" updated.`
          : `World draft \"${savedWorld.title}\" created with spine version 1.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : editingWorldId
              ? "Could not update world blueprint."
              : "Could not create world draft.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditWorld(worldId: string) {
    setIsLoadingEditor(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/author/worlds/${worldId}`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | { world?: DeskWorldDetail; error?: string }
        | null;

      if (!response.ok || !payload?.world) {
        throw new Error(payload?.error ?? "Could not load world blueprint.");
      }

      const world = payload.world;
      setEditingWorldId(world.id);
      setTitle(world.title);
      setSlug(world.slug);
      setPremise(world.premise ?? "");
      setChapterCapInput(
        typeof world.chapterCap === "number" ? String(world.chapterCap) : "",
      );
      setReaderAgency(world.readerAgency ?? "");
      setAiDirective(world.aiDirective ?? "");
      setArcStatement(world.arcStatement ?? "");
      setToneGuide(world.toneGuide ?? "");
      setNarrativeBoundaries(world.narrativeBoundaries ?? "");
      setGuardrailInstruction(world.guardrailInstruction ?? "");
      setCanonRulesInput(joinRules(world.canonRules));
      setCharacterTruthRulesInput(joinRules(world.characterTruthRules));
      setRequiredEventRulesInput(joinRules(world.requiredEventRules));
      setOutcomeRulesInput(joinRules(world.outcomeRules));
      setMessage({
        type: "success",
        text: `Editing \"${world.title}\". Save when ready.`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Could not load world blueprint.",
      });
    } finally {
      setIsLoadingEditor(false);
    }
  }

  async function handlePublishWorld(worldId: string) {
    setPublishingWorldId(worldId);
    setMessage(null);

    try {
      const response = await fetch(`/api/author/worlds/${worldId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "PUBLISH" }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { world?: DeskWorld; error?: string }
        | null;

      if (!response.ok || !payload?.world) {
        throw new Error(payload?.error ?? "Could not publish world.");
      }

      const publishedWorld = payload.world;
      setWorlds((current) => upsertWorld(current, publishedWorld));
      setMessage({
        type: "success",
        text: `\"${publishedWorld.title}\" is now published and available in the bookstore.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not publish world.",
      });
    } finally {
      setPublishingWorldId(null);
    }
  }

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
          Writer&apos;s Desk
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          Authors define the world rules. Readers move inside them. AI writes the path.
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          This desk is for author truth: canon, required events, character truths, and
          outcome limits. Readers still get agency scene by scene, while the spine
          keeps the story coherent.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="parchment-card rounded-xl p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              Author Controls
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              World setup, chapter caps, core arc, canon boundaries, and non-negotiable outcomes.
            </p>
          </article>
          <article className="parchment-card rounded-xl p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              Reader Controls
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Choices, actions, relationships, pacing, and tone inside each moment.
            </p>
          </article>
          <article className="parchment-card rounded-xl p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              AI Controls
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Real-time chapter generation while preserving authored intent and constraints.
            </p>
          </article>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <article className="parchment-card rounded-2xl p-5 shadow-lg sm:p-6">
          <h3 className="text-2xl font-semibold">
            {editingWorldId ? "Edit World Blueprint" : "Create World Blueprint"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Build or revise the active world spine. Use one line per rule. Optional format:
            <span className="font-semibold"> Title: explanation</span>.
          </p>

          <form className="mt-5 space-y-3.5" onSubmit={handleCreateOrUpdateWorld}>
            <label className="parchment-label block text-sm font-medium">World title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ash Harbor Covenant"
              className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={120}
              required
            />

            <label className="parchment-label block text-sm font-medium">Slug (optional)</label>
            <input
              type="text"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="ash-harbor-covenant"
              className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={80}
            />

            <label className="parchment-label block text-sm font-medium">Premise</label>
            <textarea
              value={premise}
              onChange={(event) => setPremise(event.target.value)}
              placeholder="What is this world at a high level?"
              className="parchment-input min-h-[80px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">
              Chapter cap (optional)
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={chapterCapInput}
              onChange={(event) => setChapterCapInput(event.target.value)}
              placeholder="Leave blank for no cap"
              className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
            />

            <label className="parchment-label block text-sm font-medium">Arc statement</label>
            <textarea
              value={arcStatement}
              onChange={(event) => setArcStatement(event.target.value)}
              placeholder="What arc must remain true from opening to ending?"
              className="parchment-input min-h-[80px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">Tone guide</label>
            <textarea
              value={toneGuide}
              onChange={(event) => setToneGuide(event.target.value)}
              placeholder="Genre voice, emotional range, and language style"
              className="parchment-input min-h-[80px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">
              Narrative boundaries
            </label>
            <textarea
              value={narrativeBoundaries}
              onChange={(event) => setNarrativeBoundaries(event.target.value)}
              placeholder="What readers can bend, and what they cannot break"
              className="parchment-input min-h-[80px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">Guardrail instruction</label>
            <textarea
              value={guardrailInstruction}
              onChange={(event) => setGuardrailInstruction(event.target.value)}
              placeholder="How the AI should redirect when reader input conflicts with canon"
              className="parchment-input min-h-[80px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">Reader agency contract</label>
            <textarea
              value={readerAgency}
              onChange={(event) => setReaderAgency(event.target.value)}
              placeholder="What choices readers should always feel they control"
              className="parchment-input min-h-[74px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">AI directive</label>
            <textarea
              value={aiDirective}
              onChange={(event) => setAiDirective(event.target.value)}
              placeholder="How the model should prioritize continuity, pacing, and clarity"
              className="parchment-input min-h-[74px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">
              Canon rules (one per line)
            </label>
            <textarea
              value={canonRulesInput}
              onChange={(event) => setCanonRulesInput(event.target.value)}
              placeholder={"Magic cannot resurrect the dead\nThe harbor treaty predates all current rulers"}
              className="parchment-input min-h-[86px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">
              Character truths (one per line)
            </label>
            <textarea
              value={characterTruthRulesInput}
              onChange={(event) => setCharacterTruthRulesInput(event.target.value)}
              placeholder={"Mara never betrays her sibling\nCaptain Ro is terrified of deep water"}
              className="parchment-input min-h-[86px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">
              Required events (one per line)
            </label>
            <textarea
              value={requiredEventRulesInput}
              onChange={(event) => setRequiredEventRulesInput(event.target.value)}
              placeholder={"The moon bell must ring before the final act\nThe treaty trial must occur"}
              className="parchment-input min-h-[86px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <label className="parchment-label block text-sm font-medium">
              Outcome constraints (one per line)
            </label>
            <textarea
              value={outcomeRulesInput}
              onChange={(event) => setOutcomeRulesInput(event.target.value)}
              placeholder={"The harbor survives\nThe betrayer is publicly revealed"}
              className="parchment-input min-h-[86px] w-full rounded-lg px-3 py-2 text-sm outline-none"
              maxLength={3000}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting || isLoadingEditor}
                className="parchment-button rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? editingWorldId
                    ? "Saving World..."
                    : "Creating World..."
                  : editingWorldId
                    ? "Save World Blueprint"
                    : "Create World Draft"}
              </button>

              {editingWorldId ? (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMessage(null);
                  }}
                  className="rounded-full border border-[var(--parchment-border)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--parchment-soft)]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          {message ? (
            <p
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                message.type === "success"
                  ? "border-emerald-700/40 bg-emerald-100/70 text-emerald-900"
                  : "border-rose-700/40 bg-rose-100/75 text-rose-900"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </article>

        <article className="parchment-card rounded-2xl p-5 shadow-lg sm:p-6">
          <h3 className="text-2xl font-semibold">Your Worlds</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Publish a world when it is ready. Published worlds appear in the bookstore for
            all app users.
          </p>

          <div className="mt-4 space-y-3">
            {sortedWorlds.length === 0 ? (
              <p className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)]">
                No worlds yet. Create your first one from the form.
              </p>
            ) : (
              sortedWorlds.map((world) => (
                <article
                  key={world.id}
                  className="rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">{world.title}</h4>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">/{world.slug}</p>
                    </div>
                    <span className="rounded-full border border-[var(--parchment-border)] bg-white/45 px-2 py-0.5 text-xs text-[var(--ink-muted)]">
                      {formatStatus(world.status)}
                    </span>
                  </div>

                  {world.premise ? (
                    <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{world.premise}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                    <span className="rounded-full border border-[var(--parchment-border)] bg-white/45 px-2 py-0.5">
                      Spine v{world.activeSpineVersion}
                    </span>
                    <span className="rounded-full border border-[var(--parchment-border)] bg-white/45 px-2 py-0.5">
                      {getRulesBadgeLabel(world.ruleCounts.total)}
                    </span>
                    <span className="rounded-full border border-[var(--parchment-border)] bg-white/45 px-2 py-0.5">
                      {typeof world.chapterCap === "number"
                        ? `Cap ${world.chapterCap} chapters`
                        : "No chapter cap"}
                    </span>
                    <span>Updated {formatDate(world.updatedAt)}</span>
                  </div>

                  <p className="mt-2 text-xs text-[var(--ink-muted)]">
                    Canon {world.ruleCounts.canon} | Character truths {world.ruleCounts.characterTruths} |
                    Required events {world.ruleCounts.requiredEvents} | Outcomes {world.ruleCounts.outcomes}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting || isLoadingEditor}
                      onClick={() => {
                        void handleEditWorld(world.id);
                      }}
                      className="rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white/65 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isLoadingEditor && editingWorldId === world.id ? "Loading..." : "Edit"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        world.status === "PUBLISHED" || Boolean(publishingWorldId)
                      }
                      onClick={() => {
                        void handlePublishWorld(world.id);
                      }}
                      className="parchment-button rounded-full px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {publishingWorldId === world.id
                        ? "Publishing..."
                        : world.status === "PUBLISHED"
                          ? "Published"
                          : "Publish To Bookstore"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
