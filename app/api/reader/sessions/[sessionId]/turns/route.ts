import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import { generateNextChapter } from "@/lib/reader-runtime";

export const runtime = "nodejs";

type CreateTurnBody = {
  directionInput?: unknown;
  readerInput?: unknown;
  model?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const id = sessionId.trim();

  if (!id) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  let body: CreateTurnBody;

  try {
    body = (await request.json()) as CreateTurnBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that turn request." },
      { status: 400 },
    );
  }

  const directionInput = typeof body.directionInput === "string"
    ? body.directionInput.trim()
    : typeof body.readerInput === "string"
      ? body.readerInput.trim()
      : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";

  try {
    const result = await generateNextChapter({
      user,
      sessionId: id,
      directionInput: directionInput || undefined,
      model: model || undefined,
    });

    return NextResponse.json(
      {
        chapter: result.chapter,
        sessionUpdatedAt: result.sessionUpdatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not create story turn." },
      { status: 500 },
    );
  }
}
