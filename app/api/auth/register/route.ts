import { NextResponse } from "next/server";

import { createSessionCookie, hashPassword } from "@/lib/auth";
import { createUserRecord, normalizeEmail, toPublicUser } from "@/lib/users";

export const runtime = "nodejs";

type RegisterRequestBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    /ECONNREFUSED|password authentication failed|database .* does not exist|role .* does not exist|connect ECONNREFUSED/i.test(
      error.message,
    )
  );
}

export async function POST(request: Request) {
  let body: RegisterRequestBody;

  try {
    body = (await request.json()) as RegisterRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that registration request." },
      { status: 400 },
    );
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : null;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (name && name.length > 80) {
    return NextResponse.json(
      { error: "Please keep the full name under 80 characters." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Passwords must be at least 8 characters long." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await createUserRecord({
      email,
      name,
      passwordHash,
      role: "READER",
    });

    const response = NextResponse.json(
      { user: toPublicUser(user) },
      { status: 201 },
    );
    response.cookies.set(createSessionCookie(user.id));

    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "An account with that email already exists."
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error:
            "Auth is not connected to PostgreSQL yet. Check DATABASE_URL or the POSTGRES_* settings.",
        },
        { status: 500 },
      );
    }

    console.error("Registration failed", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
