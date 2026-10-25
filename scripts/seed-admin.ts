import "./load-env";

import { eq, sql } from "drizzle-orm";

import { db, pool } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../lib/password";

/**
 * Seeds (or re-seeds) the admin account:
 *
 *   pnpm db:seed:admin '<password>'
 *
 * Re-running it resets the admin's password rather than failing, which is what
 * you want when the password has been lost. The password is read from argv, so
 * it is visible in shell history and to `ps` while the script runs — fine for a
 * local database, worth using a throwaway value for anything shared.
 */

const ADMIN_EMAIL = "admin@greenquote";
const ADMIN_FULL_NAME = "Admin";
const MIN_PASSWORD_LENGTH = 8;

function readPassword(): string {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    throw new Error(
      "Usage: pnpm db:seed:admin '<password>'\n" +
        "Quote the password so the shell does not expand it.",
    );
  }

  const password = args[0];

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  return password;
}

async function seedAdmin(password: string) {
  const passwordHash = await hashPassword(password);

  // Matched case-insensitively, the same way the users_email_lower_unique
  // index treats it, so a differently-cased row is updated instead of
  // colliding on insert.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${ADMIN_EMAIL})`)
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ email: ADMIN_EMAIL, passwordHash, role: "admin" })
      .where(eq(users.id, existing.id));

    return { id: existing.id, created: false };
  }

  const [created] = await db
    .insert(users)
    .values({
      fullName: ADMIN_FULL_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    })
    .returning({ id: users.id });

  return { id: created.id, created: true };
}

async function main() {
  const password = readPassword();
  const { id, created } = await seedAdmin(password);

  console.log(
    `${created ? "Created" : "Updated"} admin ${ADMIN_EMAIL} (${id}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
