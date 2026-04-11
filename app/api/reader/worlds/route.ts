import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import { listLibraryCatalogWorlds } from "@/lib/reader-runtime";

export const runtime = "nodejs";

export async function GET() {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const worlds = await listLibraryCatalogWorlds(user);

  return NextResponse.json({ worlds });
}
