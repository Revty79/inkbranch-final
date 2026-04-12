import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import {
  getAuthorWorldDetail,
  publishWorld,
  updateWorldBlueprint,
} from "@/lib/writers-desk";
import {
  ValidationError,
  type WorldBlueprintRequestBody,
  validateWorldBlueprintBody,
} from "@/app/api/author/worlds/validation";

export const runtime = "nodejs";

type PublishBody = {
  action?: unknown;
};

function canUseWritersDesk(role: string) {
  return role === "AUTHOR" || role === "ADMIN";
}

function normalizeWorldId(value: string) {
  return value.trim();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ worldId: string }> },
) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  const { worldId } = await context.params;
  const id = normalizeWorldId(worldId);

  if (!id) {
    return NextResponse.json({ error: "worldId is required." }, { status: 400 });
  }

  const world = await getAuthorWorldDetail(user.id, id);

  if (!world) {
    return NextResponse.json({ error: "World not found." }, { status: 404 });
  }

  return NextResponse.json({ world });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ worldId: string }> },
) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  const { worldId } = await context.params;
  const id = normalizeWorldId(worldId);

  if (!id) {
    return NextResponse.json({ error: "worldId is required." }, { status: 400 });
  }

  let body: WorldBlueprintRequestBody;

  try {
    body = (await request.json()) as WorldBlueprintRequestBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that world update request." },
      { status: 400 },
    );
  }

  try {
    const input = validateWorldBlueprintBody(body);
    const world = await updateWorldBlueprint({
      authorId: user.id,
      worldId: id,
      ...input,
    });

    return NextResponse.json({ world });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === "World not found.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not update world." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ worldId: string }> },
) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!canUseWritersDesk(user.role)) {
    return NextResponse.json({ error: "Author access required." }, { status: 403 });
  }

  const { worldId } = await context.params;
  const id = normalizeWorldId(worldId);

  if (!id) {
    return NextResponse.json({ error: "worldId is required." }, { status: 400 });
  }

  let body: PublishBody = {};

  try {
    body = (await request.json()) as PublishBody;
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "PUBLISH";

  if (action !== "PUBLISH") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    const world = await publishWorld(user.id, id);
    return NextResponse.json({ world });
  } catch (error) {
    if (error instanceof Error && error.message === "World not found.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not publish world." }, { status: 500 });
  }
}
