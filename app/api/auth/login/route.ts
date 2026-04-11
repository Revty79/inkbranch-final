import { NextResponse } from "next/server";

import { authenticateUser, createSessionCookie } from "@/lib/auth";
import { normalizeEmail, toPublicUser } from "@/lib/users";

export const runtime = "nodejs";

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    /ECONNREFUSED|password authentication failed|database .* does not exist|role .* does not exist|connect ECONNREFUSED/i.test(
      error.message,
    )
  );
}

export async function POST(request: Request) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that login request." },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are both required." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticateUser(email, password);

    if (!user) {
      return NextResponse.json(
        { error: "Those credentials did not match an InkBranch account." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(createSessionCookie(user.id));

    return response;
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error:
            "Auth is not connected to PostgreSQL yet. Check DATABASE_URL or the POSTGRES_* settings.",
        },
        { status: 500 },
      );
    }

    console.error("Login failed", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
