import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

/**
 * The end-to-end suite runs against a real Postgres, but never the one
 * `pnpm dev` uses: it gets its own database on the same server, created and
 * migrated before the run and dropped after it (`global-setup.ts` /
 * `global-teardown.ts`).
 *
 * By default that is the `DATABASE_URL` database with `_e2e` appended
 * (`green_quote` → `green_quote_e2e`). Set `E2E_DATABASE_URL` to point it
 * somewhere else.
 */

// Playwright runs outside Next.js, so it reads .env itself, like scripts/.
loadEnvConfig(process.cwd());

/**
 * The suite drops and recreates this database, so a name without one of these
 * suffixes is refused: a mistyped `E2E_DATABASE_URL` must not be able to wipe
 * the development database.
 */
const DISPOSABLE_SUFFIXES = ["_e2e", "_test"];

export function testDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;

  if (!explicit && !base) {
    throw new Error(
      "Set DATABASE_URL (or E2E_DATABASE_URL) before running the e2e tests. " +
        "Copy .env.example to .env and start Postgres with `docker compose up -d`.",
    );
  }

  const url = new URL(explicit ?? base!);

  if (!explicit) url.pathname = `${databaseName(url)}_e2e`;

  const name = databaseName(url);

  if (!DISPOSABLE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    throw new Error(
      `Refusing to use "${name}" for e2e tests: the suite drops it afterwards, ` +
        `so its name must end in ${DISPOSABLE_SUFFIXES.join(" or ")}.`,
    );
  }

  return url.toString();
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.slice(1));
}

/**
 * CREATE / DROP DATABASE cannot run inside the database they act on, so they
 * go through the server's `postgres` maintenance database instead.
 */
async function withMaintenanceClient<T>(
  databaseUrl: string,
  run: (client: Client, name: string) => Promise<T>,
): Promise<T> {
  const url = new URL(databaseUrl);
  const name = databaseName(url);

  url.pathname = "/postgres";

  const client = new Client({ connectionString: url.toString() });

  await client.connect();

  try {
    return await run(client, name);
  } finally {
    await client.end();
  }
}

/**
 * `WITH (FORCE)` disconnects anything still attached — the app server's pool,
 * or a run that crashed before tearing down.
 */
export async function dropTestDatabase(databaseUrl: string): Promise<void> {
  await withMaintenanceClient(databaseUrl, (client, name) =>
    client.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`),
  );
}

/**
 * Starts every run from an empty database with the current schema: whatever
 * an aborted run left behind is dropped first, then the checked-in migrations
 * are applied exactly as `pnpm db:migrate` would.
 */
export async function createTestDatabase(databaseUrl: string): Promise<void> {
  await dropTestDatabase(databaseUrl);
  await withMaintenanceClient(databaseUrl, (client, name) =>
    client.query(`CREATE DATABASE ${quoteIdent(name)}`),
  );

  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await migrate(drizzle(client), { migrationsFolder: "db/migrations" });
  } finally {
    await client.end();
  }
}

/** Database names cannot be bound as parameters, so they are quoted instead. */
function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
