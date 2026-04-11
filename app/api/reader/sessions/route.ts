import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import {
  listReaderSessions,
  startReadingFromLibrary,
} from "@/lib/reader-runtime";

export const runtime = "nodejs";

type CreateSessionBody = {
  libraryBookId?: unknown;
};

export async function GET() {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const sessions = await listReaderSessions(user.id);

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: CreateSessionBody;

  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that session request." },
      { status: 400 },
    );
  }

  const libraryBookId =
    typeof body.libraryBookId === "string" ? body.libraryBookId.trim() : "";

  if (!libraryBookId) {
    return NextResponse.json(
      { error: "libraryBookId is required." },
      { status: 400 },
    );
  }

  try {
    const reading = await startReadingFromLibrary(user, libraryBookId);

    return NextResponse.json(
      {
        session: reading.session,
        chapter: reading.chapter,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not create reader session." },
      { status: 500 },
    );
  }
}
