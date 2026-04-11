import { requireAuthorizedUser } from "@/lib/auth";

const adminAreas = [
  {
    title: "Role Management",
    summary:
      "Elevate trusted users into author or admin access while keeping public signup reader-first.",
  },
  {
    title: "Storefront Curation",
    summary:
      "Control what appears in the bookstore, which stories are featured, and how new launches are surfaced.",
  },
  {
    title: "Platform Oversight",
    summary:
      "Track growth, stability, and the operational health of the worlds living inside InkBranch.",
  },
];

export default async function AdministrationOfficePage() {
  await requireAuthorizedUser(["ADMIN"]);

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
          Administration Office
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
          Admins oversee the system, not just a single story.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
          This space is for platform-wide controls: who gets elevated access,
          what readers see in the storefront, and how the whole ecosystem is
          stewarded over time.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {adminAreas.map((area) => (
          <article key={area.title} className="parchment-card rounded-2xl p-5 shadow-lg">
            <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              Admin Control
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{area.title}</h3>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
              {area.summary}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
