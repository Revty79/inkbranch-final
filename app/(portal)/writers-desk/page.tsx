import { requireAuthorizedUser } from "@/lib/auth";

const authorTools = [
  {
    title: "World Bible",
    summary:
      "Capture canon, tone, lore, and the non-negotiable truths the AI must respect.",
  },
  {
    title: "Story Branches",
    summary:
      "Review major forks, protect continuity, and keep choices feeling meaningful instead of chaotic.",
  },
  {
    title: "Narrative Guardrails",
    summary:
      "Define safety rails, character boundaries, and scene rules so the world stays coherent.",
  },
];

export default async function WritersDeskPage() {
  await requireAuthorizedUser(["AUTHOR", "ADMIN"]);

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
          Writer&apos;s Desk
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          This is where creators shape the world before readers step inside it.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          Author access unlocks the tools that define canon, branch logic, and
          AI boundaries. The dream here is not random generation. It is guided,
          intentional, living narrative design.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {authorTools.map((tool) => (
          <article key={tool.title} className="parchment-card rounded-2xl p-5 shadow-lg">
            <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              Author Tool
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{tool.title}</h3>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
              {tool.summary}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
