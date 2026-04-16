import { randomUUID } from "node:crypto";

import type { AppRole, PublicUser, StoredUser } from "@/lib/auth-types";
import { getDatabase } from "@/lib/db";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  password_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapRowToStoredUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const db = await getDatabase();
  const result = await db.query<UserRow>(
    `
      SELECT id, email, name, role, password_hash, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizedEmail],
  );
  const row = result.rows[0];

  return row ? mapRowToStoredUser(row) : null;
}

export async function findUserById(id: string) {
  const db = await getDatabase();
  const result = await db.query<UserRow>(
    `
      SELECT id, email, name, role, password_hash, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];

  return row ? mapRowToStoredUser(row) : null;
}

export async function createUserRecord(input: {
  email: string;
  name: string | null;
  passwordHash: string;
  role: AppRole;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const db = await getDatabase();

  if (await findUserByEmail(normalizedEmail)) {
    throw new Error("An account with that email already exists.");
  }

  const trimmedName = input.name?.trim();
  const timestamp = new Date().toISOString();
  const user: StoredUser = {
    id: randomUUID(),
    email: normalizedEmail,
    name: trimmedName ? trimmedName : null,
    role: input.role,
    passwordHash: input.passwordHash,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.query(
    `
      INSERT INTO users (
        id,
        email,
        name,
        role,
        password_hash,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
    user.id,
    user.email,
    user.name,
    user.role,
    user.passwordHash,
    user.createdAt,
    user.updatedAt,
    ],
  );

  return user;
}

export async function updateUserRole(email: string, role: AppRole) {
  const normalizedEmail = normalizeEmail(email);
  const db = await getDatabase();
  const existingUser = await findUserByEmail(normalizedEmail);

  if (!existingUser) {
    return null;
  }

  const updatedAt = new Date().toISOString();

  await db.query(
    `
      UPDATE users
      SET role = $1, updated_at = $2
      WHERE email = $3
    `,
    [role, updatedAt, normalizedEmail],
  );

  return {
    ...existingUser,
    role,
    updatedAt,
  };
}

export async function updateUserRoleById(userId: string, role: AppRole) {
  const normalizedId = userId.trim();

  if (!normalizedId) {
    return null;
  }

  const db = await getDatabase();
  const existingUser = await findUserById(normalizedId);

  if (!existingUser) {
    return null;
  }

  const updatedAt = new Date().toISOString();

  await db.query(
    `
      UPDATE users
      SET role = $1, updated_at = $2
      WHERE id = $3
    `,
    [role, updatedAt, normalizedId],
  );

  return {
    ...existingUser,
    role,
    updatedAt,
  };
}
