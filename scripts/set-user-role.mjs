import { Client } from "pg";

const VALID_ROLES = new Set(["READER", "AUTHOR", "ADMIN"]);

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

const email = process.argv[2]?.trim().toLowerCase();
const role = process.argv[3]?.trim().toUpperCase();

if (!email || !role || !VALID_ROLES.has(role)) {
  console.error("Usage: npm run user:role -- user@example.com AUTHOR");
  process.exit(1);
}

const client = new Client(resolveConnectionConfig());

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL CHECK (role IN ('READER', 'AUTHOR', 'ADMIN')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  const result = await client.query(
    `
      UPDATE users
      SET role = $1, updated_at = NOW()
      WHERE email = $2
      RETURNING email, role
    `,
    [role, email],
  );

  if (result.rowCount === 0) {
    console.error(`No user found for ${email}.`);
    process.exit(1);
  }

  console.log(`Updated ${result.rows[0].email} to ${result.rows[0].role}.`);
} catch (error) {
  console.error("Failed to update user role.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
