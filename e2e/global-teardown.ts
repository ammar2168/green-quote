import { dropTestDatabase, testDatabaseUrl } from "./support/test-database";

/**
 * Drops the test database once every test has finished, pass or fail.
 * `E2E_KEEP_DB=1` keeps it for poking at with `psql` after a failure; the next
 * run drops it anyway before starting.
 */
export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DB === "1") return;

  await dropTestDatabase(testDatabaseUrl());
}
