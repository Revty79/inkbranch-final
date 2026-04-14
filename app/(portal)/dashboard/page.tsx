import Link from "next/link";

import { formatRoleLabel, requireSessionUser } from "@/lib/auth";
import { hasUnseenBookstoreContent } from "@/lib/bookstore-alerts";
import { getAccessiblePortalCards, getRolePortalSummary } from "@/lib/portal";

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const accessibleCards = getAccessiblePortalCards(user.role);
  const showBookstoreNewTag = await hasUnseenBookstoreContent(user);

  return (
    <main className="space-y-6">
      <section className="parchment-surface rounded-[1.75rem] px-5 py-6 shadow-2xl backdrop-blur-md sm:px-6 sm:py-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="space-y-4">
            <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
              Dashboard
            </p>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              The branch opens differently for every role.
            </h2>
            <p className="max-w-3xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
              Readers arrive ready to discover and collect stories. Authors gain
              the tools to shape them. Admins can move across the whole platform
              and guide the system itself.
            </p>
          </div>

          <div className="parchment-card rounded-2xl p-5 shadow-lg">
            <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              Current Access
            </p>
            <p className="mt-3 text-2xl font-semibold">{formatRoleLabel(user.role)}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              {getRolePortalSummary(user.role)}
            </p>
            <p className="mt-4 text-sm font-medium text-[var(--ink)]">
              Rooms available now: {accessibleCards.length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {accessibleCards.map((card) => {
          const shouldShowNewTag = card.href === "/bookstore" && showBookstoreNewTag;

          return (
            <Link key={card.href} href={card.href} className={`book-card ${card.themeClassName}`}>
              <div className="relative z-10">
                <p className="book-card-kicker">{card.kicker}</p>
                <h3 className="book-card-title">{card.title}</h3>
                <p className="book-card-description">{card.description}</p>
              </div>
              <div className="relative z-10 flex items-end justify-between gap-3 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="book-card-status">{card.statusLabel}</span>
                  {shouldShowNewTag ? (
                    <span className="rounded-full border border-[rgba(248,239,219,0.62)] bg-[rgba(255,255,255,0.16)] px-2 py-0.5 text-[10px] leading-none font-semibold tracking-[0.1em] text-[rgba(248,239,219,0.98)] uppercase">
                      New
                    </span>
                  ) : null}
                </div>
                <span className="text-sm font-semibold text-[rgba(248,239,219,0.92)]">
                  {card.callToAction}
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="parchment-card rounded-2xl p-5 shadow-lg">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Reader Journey
          </p>
          <h3 className="mt-3 text-2xl font-semibold">Bookstore first, then library.</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            The storefront is where new interactive stories are purchased.
            Once a story belongs to the reader, it should feel at home in the
            library as a living experience they can return to any time.
          </p>
        </div>

        <div className="parchment-card rounded-2xl p-5 shadow-lg">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Role Growth
          </p>
          <h3 className="mt-3 text-2xl font-semibold">Creation and oversight expand from there.</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Authors gain the writer&apos;s workspace without losing the reader
            journey. Admins inherit every room so they can support creators,
            readers, and the platform itself.
          </p>
        </div>
      </section>
    </main>
  );
}
