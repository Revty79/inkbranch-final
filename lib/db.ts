import { Pool, type PoolConfig } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  __inkbranchPool?: Pool;
  __inkbranchSchemaReady?: Promise<void>;
};

function resolvePoolConfig(): PoolConfig {
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

function getPoolInstance() {
  if (!globalForDatabase.__inkbranchPool) {
    globalForDatabase.__inkbranchPool = new Pool(resolvePoolConfig());
  }

  return globalForDatabase.__inkbranchPool;
}

async function initializeSchema() {
  const pool = getPoolInstance();

  await pool.query(`
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
}

export async function getDatabase() {
  if (!globalForDatabase.__inkbranchSchemaReady) {
    globalForDatabase.__inkbranchSchemaReady = initializeSchema().catch(
      (error) => {
        globalForDatabase.__inkbranchSchemaReady = undefined;
        throw error;
      },
    );
  }

  await globalForDatabase.__inkbranchSchemaReady;

  return getPoolInstance();
}
