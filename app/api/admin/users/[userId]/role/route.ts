import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth";
import type { AppRole } from "@/lib/auth-types";
import { findUserById, updateUserRoleById } from "@/lib/users";

export const runtime = "nodejs";

type UpdateUserRoleBody = {
  role?: unknown;
};

function isAppRole(value: unknown): value is AppRole {
  return value === "READER" || value === "AUTHOR" || value === "ADMIN";
}

function normalizeUserId(value: string) {
  return value.trim();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const user = await getOptionalSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { userId } = await context.params;
  const targetUserId = normalizeUserId(userId);

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  let body: UpdateUserRoleBody;

  try {
    body = (await request.json()) as UpdateUserRoleBody;
  } catch {
    return NextResponse.json(
      { error: "We could not read that role update request." },
      { status: 400 },
    );
  }

  const requestedRole = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";

  if (!isAppRole(requestedRole)) {
    return NextResponse.json(
      { error: "role must be one of READER, AUTHOR, or ADMIN." },
      { status: 400 },
    );
  }

  if (targetUserId === user.id && requestedRole !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot remove your own admin role from this panel." },
      { status: 400 },
    );
  }

  const targetUser = await findUserById(targetUserId);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (targetUser.role === requestedRole) {
    return NextResponse.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        updatedAt: targetUser.updatedAt,
      },
    });
  }

  const updated = await updateUserRoleById(targetUser.id, requestedRole);

  if (!updated) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      updatedAt: updated.updatedAt,
    },
  });
}
