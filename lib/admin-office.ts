import type { AppRole } from "@/lib/auth-types";
import { getDatabase } from "@/lib/db";

type ReaderBookEngagementRow = {
  user_id: string;
  email: string;
  name: string | null;
  role: AppRole;
  books_owned: number | string | null;
  sessions_started: number | string | null;
  total_reading_seconds: number | string | null;
  last_session_updated_at: Date | string | null;
  recent_books: string[] | null;
};

export type AdminReaderBookEngagement = {
  userId: string;
  email: string;
  name: string | null;
  role: AppRole;
  booksOwned: number;
  sessionsStarted: number;
  totalReadingSeconds: number;
  lastSessionUpdatedAt: string | null;
  recentBooks: string[];
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

export async function listAdminReaderBookEngagement(
  limit = 250,
): Promise<AdminReaderBookEngagement[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.floor(limit), 1000))
    : 250;
  const db = await getDatabase();
  const result = await db.query<ReaderBookEngagementRow>(
    `
      SELECT
        users.id AS user_id,
        users.email,
        users.name,
        users.role,
        COALESCE(library.books_owned, 0) AS books_owned,
        COALESCE(sessions.sessions_started, 0) AS sessions_started,
        COALESCE(sessions.total_reading_seconds, 0) AS total_reading_seconds,
        sessions.last_session_updated_at,
        COALESCE(recent.recent_books, ARRAY[]::text[]) AS recent_books
      FROM users
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS books_owned
        FROM library_books AS lb
        WHERE lb.user_id = users.id
      ) AS library
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS sessions_started,
          COALESCE(SUM(story_sessions.reading_seconds), 0) AS total_reading_seconds,
          MAX(story_sessions.updated_at) AS last_session_updated_at
        FROM story_sessions
        WHERE story_sessions.reader_id = users.id
      ) AS sessions
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT worlds.title
          FROM library_books AS lb
          JOIN story_worlds AS worlds
            ON worlds.id = lb.world_id
          WHERE lb.user_id = users.id
          ORDER BY lb.created_at DESC
          LIMIT 3
        ) AS recent_books
      ) AS recent
        ON TRUE
      WHERE COALESCE(library.books_owned, 0) > 0
        OR COALESCE(sessions.sessions_started, 0) > 0
      ORDER BY
        COALESCE(sessions.total_reading_seconds, 0) DESC,
        COALESCE(library.books_owned, 0) DESC,
        users.created_at DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    booksOwned: toNumber(row.books_owned),
    sessionsStarted: toNumber(row.sessions_started),
    totalReadingSeconds: toNumber(row.total_reading_seconds),
    lastSessionUpdatedAt: row.last_session_updated_at
      ? new Date(row.last_session_updated_at).toISOString()
      : null,
    recentBooks: row.recent_books ?? [],
  }));
}
