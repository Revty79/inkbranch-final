import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Add it to .env.local or your shell environment before running Drizzle commands.",
  );
}

function isLikelyLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function resolveDrizzleSsl(hostname: string) {
  const configuredFlag = process.env.POSTGRES_SSL?.trim().toLowerCase();

  if (configuredFlag === "true") {
    return "require" as const;
  }

  if (!isLikelyLocalHostname(hostname)) {
    return "require" as const;
  }

  return undefined;
}

function resolveDbCredentials() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  let parsed: URL;

  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is invalid and could not be parsed as a URL.");
  }

  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 5432;
  const user = decodeURIComponent(parsed.username || "");
  const password = decodeURIComponent(parsed.password || "");
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!host || !user || !databaseName) {
    throw new Error(
      "DATABASE_URL must include host, username, and database name for Drizzle migrations.",
    );
  }

  return {
    host,
    port,
    user,
    password,
    database: databaseName,
    ssl: resolveDrizzleSsl(host),
  };
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: resolveDbCredentials(),
  verbose: true,
  strict: false,
});
