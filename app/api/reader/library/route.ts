import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import {
  addWorldToLibrary,
  listLibraryBooks,
} from "@/lib/reader-runtime";

export const runtime = "nodejs";

type AddLibraryBookBody = {
  worldId?: unknown;
};

export async function GET() {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const books = await listLibraryBooks(user);

  return NextResponse.json({ books });
}

export async function POST(request: Request) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: AddLibraryBookBody;

  try {
    body = (await request.json()) as AddLibraryBookBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that add-to-library request." },
      { status: 400 },
    );
  }

  const worldId = typeof body.worldId === "string" ? body.worldId.trim() : "";

  if (!worldId) {
    return NextResponse.json(
      { error: "worldId is required." },
      { status: 400 },
    );
  }

  try {
    const book = await addWorldToLibrary(user, worldId);

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not add book to library." },
      { status: 500 },
    );
  }
}
