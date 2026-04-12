import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import {
  createWorldWithInitialSpine,
  listAuthorWorlds,
} from "@/lib/writers-desk";
import {
  ValidationError,
  type WorldBlueprintRequestBody,
  validateWorldBlueprintBody,
} from "@/app/api/author/worlds/validation";

export const runtime = "nodejs";

function canUseWritersDesk(role: string) {
  return role === "AUTHOR" || role === "ADMIN";
}

export async function GET() {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  const worlds = await listAuthorWorlds(user.id);

  return NextResponse.json({ worlds });
}

export async function POST(request: Request) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  let body: WorldBlueprintRequestBody;

  try {
    body = (await request.json()) as WorldBlueprintRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that world creation request." },
      { status: 400 },
    );
  }

  try {
    const input = validateWorldBlueprintBody(body);
    const world = await createWorldWithInitialSpine({
      authorId: user.id,
      ...input,
    });

    return NextResponse.json({ world }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("World creation failed", error);

    return NextResponse.json(
      { error: "Could not create world draft." },
      { status: 500 },
    );
  }
}
