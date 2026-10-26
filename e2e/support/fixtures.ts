import { randomUUID } from "node:crypto";

import { test as base, expect, type Page } from "@playwright/test";
import { Pool } from "pg";

import { hashPassword } from "@/lib/password";

import { testDatabaseUrl } from "./test-database";

export type TestUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
};

/**
 * `db` is a connection to the test database, for arranging rows and checking
 * what the app wrote. `user` is a fresh account inserted straight into it, so
 * each test owns its data and tests can run in parallel without seeing each
 * other's quotes.
 *
 * The second fixture argument is Playwright's `use`, renamed so the React
 * Hooks lint rule does not mistake it for React's `use`.
 */
export const test = base.extend<{ user: TestUser }, { db: Pool }>({
  db: [
    async ({}, provide) => {
      const pool = new Pool({ connectionString: testDatabaseUrl() });

      await provide(pool);
      await pool.end();
    },
    { scope: "worker" },
  ],

  user: async ({ db }, provide) => {
    const user = {
      fullName: "Ada Lovelace",
      email: `ada-${randomUUID()}@example.test`,
      password: "correct horse battery",
    };

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [user.fullName, user.email, await hashPassword(user.password)],
    );

    await provide({ ...user, id: rows[0].id });
  },
});

export { expect };

/** Signs in through the real form, as a person would. */
export async function signIn(
  page: Page,
  { email, password }: Pick<TestUser, "email" | "password">,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
