import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import {
  generateChapterViewpoint,
  type ReaderChapterViewpointLens,
} from "@/lib/reader-runtime";

export const runtime = "nodejs";

type CreateViewpointBody = {
  characterName?: unknown;
  lens?: unknown;
  directionInput?: unknown;
  model?: unknown;
};

function toOptionalViewpointLens(input: unknown): ReaderChapterViewpointLens | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const normalized = input.trim().toUpperCase();

  if (
    normalized === "MOMENT" ||
    normalized === "THREAD" ||
    normalized === "SPINOFF"
  ) {
    return normalized;
  }

  return undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; chapterId: string }> },
) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { sessionId, chapterId } = await context.params;
  const normalizedSessionId = sessionId.trim();
  const normalizedChapterId = chapterId.trim();

  if (!normalizedSessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  if (!normalizedChapterId) {
    return NextResponse.json({ error: "chapterId is required." }, { status: 400 });
  }

  let body: CreateViewpointBody;

  try {
    body = (await request.json()) as CreateViewpointBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that viewpoint request." },
      { status: 400 },
    );
  }

  const characterName =
    typeof body.characterName === "string" ? body.characterName.trim() : "";
  const directionInput =
    typeof body.directionInput === "string" ? body.directionInput.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const lens = toOptionalViewpointLens(body.lens);

  if (!characterName) {
    return NextResponse.json({ error: "characterName is required." }, { status: 400 });
  }

  try {
    const result = await generateChapterViewpoint({
      user,
      sessionId: normalizedSessionId,
      chapterId: normalizedChapterId,
      characterName,
      lens,
      directionInput: directionInput || undefined,
      model: model || undefined,
    });

    return NextResponse.json(
      {
        viewpoint: result.viewpoint,
        sessionUpdatedAt: result.sessionUpdatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not generate chapter viewpoint." },
      { status: 500 },
    );
  }
}
