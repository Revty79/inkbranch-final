import { requireAuthorizedUser } from "@/lib/auth";

const libraryEntries = [
  {
    title: "A Court of Glass Roads",
    progress: "Chapter 7",
    summary: "A political fantasy route where your alliances still feel salvageable.",
  },
  {
    title: "Moonwell Protocol",
    progress: "Newly Added",
    summary: "A purchased story waiting for its first decision and first consequence.",
  },
  {
    title: "Ember Choir",
    progress: "Final Arc",
    summary: "A nearly completed path whose ending depends on what you refuse to sacrifice.",
  },
];

export default async function LibraryPage() {
  await requireAuthorizedUser(["READER", "AUTHOR", "ADMIN"]);

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
          Library
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          Owned stories live here.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          Your library is the home for purchased adventures, active playthroughs,
          and every world you want to return to later. It should feel organized,
          warm, and deeply personal.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {libraryEntries.map((entry) => (
          <article key={entry.title} className="parchment-card rounded-2xl p-5 shadow-lg">
            <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              {entry.progress}
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{entry.title}</h3>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
              {entry.summary}
            </p>
            <button
              type="button"
              className="parchment-button mt-5 rounded-full px-4 py-2 text-sm font-semibold"
            >
              Continue Story
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
