import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AppRole, PublicUser, StoredUser } from "@/lib/auth-types";
import { findUserByEmail, findUserById, toPublicUser } from "@/lib/users";

const SESSION_COOKIE_NAME = "inkbranch_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;
const SESSION_SECRET =
  process.env.INKBRANCH_AUTH_SECRET?.trim() ||
  "inkbranch-local-dev-secret-change-me";

type SessionPayload = {
  sub: string;
  exp: number;
  version: 1;
};

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      {
        N: 16384,
        r: 8,
        p: 1,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function createSessionSignature(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function encodeSessionPayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSessionPayload(value: string) {
  try {
    return JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as SessionPayload;
  } catch {
    return null;
  }
}

function signSessionToken(userId: string) {
  const payload = encodeSessionPayload({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    version: 1,
  });

  return `${payload}.${createSessionSignature(payload)}`;
}

function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createSessionSignature(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decoded = decodeSessionPayload(payload);

  if (
    !decoded ||
    decoded.version !== 1 ||
    !decoded.sub ||
    decoded.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return decoded;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
) {
  const [salt, expectedHash] = passwordHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}

export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  return passwordMatches ? user : null;
}

export function createSessionCookie(userId: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: signSessionToken(userId),
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    priority: "high" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    priority: "high" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getOptionalSessionUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const payload = verifySessionToken(sessionToken);

  if (!payload) {
    return null;
  }

  const user = await findUserById(payload.sub);

  return user ? toPublicUser(user) : null;
}

export async function requireSessionUser() {
  const user = await getOptionalSessionUser();

  if (!user) {
    redirect("/");
  }

  return user;
}

export async function requireAuthorizedUser(allowedRoles: AppRole[]) {
  const user = await requireSessionUser();

  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export function formatRoleLabel(role: AppRole) {
  switch (role) {
    case "READER":
      return "Reader";
    case "AUTHOR":
      return "Author";
    case "ADMIN":
      return "Admin";
  }
}

export function formatUserGreeting(user: PublicUser | StoredUser) {
  return user.name?.trim() ? user.name.trim() : user.email;
}

export { SESSION_COOKIE_NAME };
