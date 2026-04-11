import Link from "next/link";

import { requireAuthorizedUser } from "@/lib/auth";

const featuredStories = [
  {
    title: "The Lantern Archive",
    genre: "Mystery Fantasy",
    price: "$7.99",
    description:
      "A city of living manuscripts hides a vanished chapter that changes every reader who touches it.",
  },
  {
    title: "Saltwake Rebellion",
    genre: "Oceanic Sci-Fi",
    price: "$9.99",
    description:
      "Command a tide-borne uprising where every alliance reshapes the fate of an empire on the brink.",
  },
  {
    title: "Ashes of Bellharbor",
    genre: "Gothic Adventure",
    price: "$6.99",
    description:
      "Walk the haunted streets of Bellharbor and decide which truths deserve to survive the fire.",
  },
];

export default async function BookstorePage() {
  await requireAuthorizedUser(["READER", "AUTHOR", "ADMIN"]);

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
          Bookstore
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          This is where readers discover and purchase new stories.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          The InkBranch bookstore is your storefront for new worlds. Once a
          story is purchased, it should feel like it belongs to your library as
          an ongoing interactive experience, not a disposable one-time read.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {featuredStories.map((story) => (
          <article key={story.title} className="parchment-card rounded-2xl p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
                  {story.genre}
                </p>
                <h3 className="mt-2 text-2xl font-semibold">{story.title}</h3>
              </div>
              <span className="rounded-full border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-1 text-sm font-semibold text-[var(--ink)]">
                {story.price}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
              {story.description}
            </p>
            <button
              type="button"
              className="parchment-button mt-5 rounded-full px-4 py-2 text-sm font-semibold"
            >
              Purchase Story
            </button>
          </article>
        ))}
      </section>

      <section className="parchment-card rounded-2xl p-5 shadow-lg">
        <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
          Next Step
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          Purchased stories should flow directly into the reader&apos;s collection.
          The dashboard already treats the bookstore as the acquisition space and
          the library as the owned-story space.
        </p>
        <Link
          href="/library"
          className="mt-4 inline-flex rounded-full border border-[var(--parchment-border)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--parchment-soft)]"
        >
          Go to Library
        </Link>
      </section>
    </main>
  );
}
