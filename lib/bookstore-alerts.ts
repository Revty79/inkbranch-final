import type { PublicUser } from "@/lib/auth-types";
import { getDatabase } from "@/lib/db";

type BookstoreFreshnessRow = {
  latest_visible_at: Date | string | null;
  bookstore_seen_at: Date | string | null;
};

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : null;
}

export async function hasUnseenBookstoreContent(user: PublicUser) {
  const db = await getDatabase();
  const result = await db.query<BookstoreFreshnessRow>(
    `
      SELECT
        (
          SELECT MAX(worlds.updated_at)
          FROM story_worlds AS worlds
          WHERE (
            $1 = 'ADMIN'
            OR ($1 = 'AUTHOR' AND (worlds.status = 'PUBLISHED' OR worlds.author_id = $2))
            OR ($1 = 'READER' AND worlds.status = 'PUBLISHED')
          )
        ) AS latest_visible_at,
        users.bookstore_seen_at
      FROM users
      WHERE users.id = $2
      LIMIT 1
    `,
    [user.role, user.id],
  );

  const row = result.rows[0];

  if (!row) {
    return false;
  }

  const latestVisibleAt = toTimestamp(row.latest_visible_at);

  if (latestVisibleAt == null) {
    return false;
  }

  const seenAt = toTimestamp(row.bookstore_seen_at);

  return seenAt == null || seenAt < latestVisibleAt;
}

export async function markBookstoreAsSeen(userId: string, seenAt = new Date().toISOString()) {
  const db = await getDatabase();

  await db.query(
    `
      UPDATE users
      SET bookstore_seen_at = COALESCE(
        GREATEST(bookstore_seen_at, $1::timestamptz),
        $1::timestamptz
      )
      WHERE id = $2
    `,
    [seenAt, userId],
  );
}
