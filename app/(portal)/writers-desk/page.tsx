import { requireAuthorizedUser } from "@/lib/auth";
import { listAuthorWorlds } from "@/lib/writers-desk";

import { WritersDeskClient } from "./writers-desk-client";

export default async function WritersDeskPage() {
  const user = await requireAuthorizedUser(["AUTHOR", "ADMIN"]);
  const initialWorlds = await listAuthorWorlds(user.id);

  return <WritersDeskClient initialWorlds={initialWorlds} />;
}
