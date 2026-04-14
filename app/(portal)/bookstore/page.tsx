import { requireAuthorizedUser } from "@/lib/auth";
import { markBookstoreAsSeen } from "@/lib/bookstore-alerts";
import { listBookstoreBooks } from "@/lib/reader-runtime";

import { BookstoreClient } from "./bookstore-client";

export default async function BookstorePage() {
  const user = await requireAuthorizedUser(["READER", "AUTHOR", "ADMIN"]);
  const [initialBooks] = await Promise.all([
    listBookstoreBooks(user),
    markBookstoreAsSeen(user.id),
  ]);

  return <BookstoreClient initialBooks={initialBooks} />;
}
