import { requireAuthorizedUser } from "@/lib/auth";
import {
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

  return (
    <LibraryReaderClient
      initialBooks={books}
      initialCatalogWorlds={catalogWorlds}
      initialSessions={sessions}
      initialActiveSession={null}
    />
  );
}
