import Link from "next/link";

import { AmbientPlayer } from "@/components/ambient-player";
import { LogoutButton } from "@/components/logout-button";
import { formatRoleLabel, formatUserGreeting, requireSessionUser } from "@/lib/auth";
import { getAccessiblePortalCards } from "@/lib/portal";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireSessionUser();
  const accessibleCards = getAccessiblePortalCards(user.role);

  return (
    <div className="min-h-screen px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col">
        <header className="parchment-surface rounded-[1.75rem] px-5 py-5 shadow-2xl backdrop-blur-md sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                  InkBranch Portal
                </p>
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                  Welcome back, {formatUserGreeting(user)}.
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                  {formatRoleLabel(user.role)}
                </span>
                <span className="text-sm text-[var(--ink-muted)]">
                  {user.email}
                </span>
              </div>
              <nav className="flex flex-wrap gap-2 pt-1">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-white/80"
                >
                  Dashboard
                </Link>
                {accessibleCards.map((card) => (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="rounded-full border border-[var(--parchment-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--parchment-soft)]"
                  >
                    {card.title}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex w-full flex-col items-end gap-3 xl:w-auto">
              <AmbientPlayer />
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="mt-6 flex-1">{children}</div>
      </div>
    </div>
  );
}
