import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { Client } from "pg";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const command = process.argv[2]?.trim().toLowerCase();
const email = process.argv[3]?.trim().toLowerCase();
const password = process.argv[4];

function resolveConnectionConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (connectionString) {
    return {
      connectionString,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: process.env.POSTGRES_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DATABASE?.trim() || "inkbranch",
    user: process.env.POSTGRES_USER?.trim() || "inkbranch_app",
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

async function hashPassword(plainTextPassword) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(plainTextPassword, salt, PASSWORD_KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(plainTextPassword, passwordHash) {
  const [salt, expectedHash] = String(passwordHash).split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const derivedKey = await scrypt(plainTextPassword, salt, PASSWORD_KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}

if (!command || !email || !password || !["check", "set"].includes(command)) {
  console.error("Usage:");
  console.error("npm run user:password:check -- user@example.com yourPassword");
  console.error("npm run user:password:set -- user@example.com newPassword");
  process.exit(1);
}

const client = new Client(resolveConnectionConfig());

try {
  await client.connect();

  const result = await client.query(
    `
      SELECT id, email, password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );

  if (result.rowCount === 0) {
    console.error(`No user found for ${email}.`);
    process.exit(1);
  }

  const user = result.rows[0];

  if (command === "check") {
    const matches = await verifyPassword(password, user.password_hash);
    console.log(
      matches
        ? `Password matches for ${user.email}.`
        : `Password does not match for ${user.email}.`,
    );
    process.exit(matches ? 0 : 1);
  }

  const passwordHash = await hashPassword(password);
  await client.query(
    `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, user.id],
  );

  console.log(`Password updated for ${user.email}.`);
} catch (error) {
  console.error("Password operation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
