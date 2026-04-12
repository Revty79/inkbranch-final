import { requireAuthorizedUser } from "@/lib/auth";
import { listBookstoreBooks } from "@/lib/reader-runtime";

import { BookstoreClient } from "./bookstore-client";

export default async function BookstorePage() {
  const user = await requireAuthorizedUser(["READER", "AUTHOR", "ADMIN"]);
  const initialBooks = await listBookstoreBooks(user);

  return <BookstoreClient initialBooks={initialBooks} />;
}
