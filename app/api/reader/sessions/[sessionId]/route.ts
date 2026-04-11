import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import { getReaderSessionDetail } from "@/lib/reader-runtime";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
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

  const session = await getReaderSessionDetail(user, id);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ session });
}
