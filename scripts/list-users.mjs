import { Client } from "pg";

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

const client = new Client(resolveConnectionConfig());

try {
  await client.connect();
  const result = await client.query(`
    SELECT email, name, role, created_at, updated_at
    FROM users
    ORDER BY created_at ASC
  `);

  if (result.rowCount === 0) {
    console.log("No users found.");
  } else {
    console.table(result.rows);
  }
} catch (error) {
  console.error("Failed to list users.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
