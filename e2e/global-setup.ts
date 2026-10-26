import { createTestDatabase, testDatabaseUrl } from "./support/test-database";

/** Creates and migrates a fresh test database before any test runs. */
export default async function globalSetup() {
  await createTestDatabase(testDatabaseUrl());
}
