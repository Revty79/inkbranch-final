import { requireAuthorizedUser } from "@/lib/auth";
import {
  listAdminReaderBookEngagement,
  listAdminUserRoleDirectory,
} from "@/lib/admin-office";

import { RoleManagementClient } from "./role-management-client";

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

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "0m";
  }

  if (seconds < 60) {
    return "<1m";
  }

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatRole(role: "READER" | "AUTHOR" | "ADMIN") {
  switch (role) {
    case "READER":
      return "Reader";
    case "AUTHOR":
      return "Author";
    case "ADMIN":
      return "Admin";
  }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No session activity";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdministrationOfficePage() {
  const user = await requireAuthorizedUser(["ADMIN"]);
  const [readerEngagement, roleDirectory] = await Promise.all([
    listAdminReaderBookEngagement(),
    listAdminUserRoleDirectory(),
  ]);
  const usersTracked = readerEngagement.length;
  const totalBooksOwned = readerEngagement.reduce((sum, row) => sum + row.booksOwned, 0);
  const totalReadingSeconds = readerEngagement.reduce(
    (sum, row) => sum + row.totalReadingSeconds,
    0,
  );
  const usersWithReadingTime = readerEngagement.filter(
    (row) => row.totalReadingSeconds > 0,
  ).length;

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="parchment-card rounded-2xl p-4 shadow-lg">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Users Tracked
          </p>
          <p className="mt-2 text-3xl font-semibold">{usersTracked}</p>
        </article>
        <article className="parchment-card rounded-2xl p-4 shadow-lg">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Books Owned
          </p>
          <p className="mt-2 text-3xl font-semibold">{totalBooksOwned}</p>
        </article>
        <article className="parchment-card rounded-2xl p-4 shadow-lg">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Total Reading Time
          </p>
          <p className="mt-2 text-3xl font-semibold">{formatDuration(totalReadingSeconds)}</p>
        </article>
        <article className="parchment-card rounded-2xl p-4 shadow-lg">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Readers With Time
          </p>
          <p className="mt-2 text-3xl font-semibold">{usersWithReadingTime}</p>
        </article>
      </section>

      <RoleManagementClient
        initialUsers={roleDirectory}
        currentAdminUserId={user.id}
      />

      <section className="parchment-card rounded-2xl p-4 shadow-lg sm:p-5">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            Reader Engagement
          </p>
          <h3 className="text-2xl font-semibold">Who owns books and how long they read</h3>
          <p className="text-sm text-[var(--ink-muted)]">
            Reading time is measured from active reader heartbeat pings while a session is open.
          </p>
        </div>

        {readerEngagement.length === 0 ? (
          <p className="mt-4 rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)]">
            No reader ownership or activity data yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--parchment-border)]">
            <table className="min-w-[920px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--parchment-soft)] text-left text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Books Owned</th>
                  <th className="px-3 py-2 font-semibold">Reading Time</th>
                  <th className="px-3 py-2 font-semibold">Sessions</th>
                  <th className="px-3 py-2 font-semibold">Recent Books</th>
                  <th className="px-3 py-2 font-semibold">Last Session Update</th>
                </tr>
              </thead>
              <tbody>
                {readerEngagement.map((row) => (
                  <tr key={row.userId} className="border-t border-[var(--parchment-border)] align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{row.name?.trim() || "Unnamed User"}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{row.email}</p>
                    </td>
                    <td className="px-3 py-2">{formatRole(row.role)}</td>
                    <td className="px-3 py-2">{row.booksOwned}</td>
                    <td className="px-3 py-2">{formatDuration(row.totalReadingSeconds)}</td>
                    <td className="px-3 py-2">{row.sessionsStarted}</td>
                    <td className="px-3 py-2">
                      {row.recentBooks.length > 0 ? row.recentBooks.join(", ") : "No books listed"}
                    </td>
                    <td className="px-3 py-2">{formatDateTime(row.lastSessionUpdatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
