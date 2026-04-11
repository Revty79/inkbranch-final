import { requireAuthorizedUser } from "@/lib/auth";
import {
  getReaderSessionDetail,
  listLibraryBooks,
  listLibraryCatalogWorlds,
  listReaderSessions,
} from "@/lib/reader-runtime";

import { LibraryReaderClient } from "./reader-library-client";

export default async function LibraryPage() {
  const user = await requireAuthorizedUser(["READER", "AUTHOR", "ADMIN"]);

  const [books, catalogWorlds, sessions] = await Promise.all([
    listLibraryBooks(user),
    listLibraryCatalogWorlds(user),
    listReaderSessions(user.id),
  ]);

  const initialSession = sessions[0]
    ? await getReaderSessionDetail(user, sessions[0].id)
    : null;

  return (
    <LibraryReaderClient
      initialBooks={books}
      initialCatalogWorlds={catalogWorlds}
      initialSessions={sessions}
      initialActiveSession={initialSession}
    />
  );
}
