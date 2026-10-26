import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { logger } from "../lib/logger";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and start Postgres with `docker compose up -d`.",
  );
}

// `next dev` re-evaluates modules on every hot reload, which would otherwise
// leak a new pool each time until Postgres runs out of connections.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? createPool(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

export { pool };

/**
 * node-postgres emits `error` on the pool when Postgres closes an idle
 * connection (a restart, or the e2e suite dropping its database). Unhandled,
 * that is an uncaughtException that takes the server down; the pool already
 * discards the broken client and opens a new one on the next query.
 */
function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString });

  pool.on("error", (error) => {
    logger.warn("postgres idle connection closed", {
      source: "db",
      err: error,
    });
  });

  return pool;
}
