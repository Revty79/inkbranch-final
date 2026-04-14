import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import { recordReaderActivity } from "@/lib/reader-runtime";

export const runtime = "nodejs";

type ReaderActivityBody = {
  sessionId?: unknown;
  secondsSpent?: unknown;
};

function parseSecondsSpent(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }

  return Number.NaN;
}

export async function POST(request: Request) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: ReaderActivityBody;

  try {
    body = (await request.json()) as ReaderActivityBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that reader activity request." },
      { status: 400 },
    );
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const secondsSpent = parseSecondsSpent(body.secondsSpent);

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(secondsSpent) || secondsSpent <= 0) {
    return NextResponse.json(
      { error: "secondsSpent must be a positive number." },
      { status: 400 },
    );
  }

  try {
    await recordReaderActivity({
      user,
      sessionId,
      secondsSpent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not record reader activity." },
      { status: 500 },
    );
  }
}
