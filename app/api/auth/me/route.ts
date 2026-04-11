import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  getOptionalSessionUser,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getOptionalSessionUser();
  const response = NextResponse.json(
    { user },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );

  if (!user && request.cookies.get(SESSION_COOKIE_NAME)) {
    response.cookies.set(clearSessionCookie());
  }

  return response;
}
