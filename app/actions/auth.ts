"use server";

import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import type { AuthFormState } from "@/lib/auth-form-state";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

const MIN_PASSWORD_LENGTH = 8;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 200;

/** Where both sign-up and sign-in land. */
const AFTER_AUTH = "/quotes/new";

/** Where an admin lands on sign-in instead. */
const AFTER_ADMIN_AUTH = "/admin/users";

/**
 * A real hash of a value nobody knows, verified against when no user matches
 * so that a wrong email costs the same scrypt time as a wrong password.
 * Without it, response time tells an attacker which emails have accounts.
 *
 * Hashed once at startup rather than hardcoded, so it always uses the current
 * scrypt parameters — a hardcoded one would stay cheap after they are raised,
 * reopening the timing gap.
 */
const DECOY_HASH = hashPassword(randomBytes(32).toString("hex"));

/**
 * Deliberately vague: sign-in never says whether it was the email or the
 * password that was wrong, so the form cannot be used to test which addresses
 * are registered.
 */
const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * Auth events are logged by user id and outcome only: never the password, and
 * not the email either, since a mistyped password is sometimes typed into the
 * email field.
 */
const authLog = logger.child({ source: "auth" });

/** Good enough to catch typos; the real check is whether mail arrives. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

export async function signup(
  _prevState: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = readField(formData, "fullName");
  const email = readField(formData, "email");
  // Not trimmed: leading and trailing spaces are legitimate password characters.
  const password = String(formData.get("password") ?? "");

  const values = { fullName, email };
  const errors: NonNullable<AuthFormState["errors"]> = {};

  if (!fullName) {
    errors.fullName = "Enter your name.";
  } else if (fullName.length > MAX_NAME_LENGTH) {
    errors.fullName = `Must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (!email) {
    errors.email = "Enter your email.";
  } else if (email.length > MAX_EMAIL_LENGTH || !looksLikeEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    authLog.info("sign-up rejected", {
      reason: "invalid_fields",
      invalidFields: Object.keys(errors),
    });

    return { errors, values };
  }

  const passwordHash = await hashPassword(password);

  let userId: string;

  try {
    const [created] = await db
      .insert(users)
      .values({ fullName, email, passwordHash })
      .returning({ id: users.id });

    userId = created.id;
  } catch (error: unknown) {
    // users_email_lower_unique rejected it. Checking for the row first would
    // still race, so the constraint is the check and this is the handler.
    if (isUniqueViolation(error)) {
      authLog.info("sign-up rejected", { reason: "email_taken" });

      return {
        errors: { email: "That email already has an account." },
        values,
      };
    }

    throw error;
  }

  await createSession(userId);

  authLog.info("signed up", { userId });

  // Outside the try: redirect() signals by throwing, so a catch would swallow it.
  redirect(AFTER_AUTH);
}

export async function login(
  _prevState: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email");
  const password = String(formData.get("password") ?? "");

  const values = { email };

  if (!email || !password) {
    authLog.info("sign-in rejected", { reason: "missing_fields" });

    return { message: INVALID_CREDENTIALS, values };
  }

  // Matched case-insensitively against the same expression as the
  // users_email_lower_unique index, so the index serves the lookup.
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
    })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (!user) {
    await verifyPassword(password, await DECOY_HASH);

    // Repeated warnings here are what credential stuffing looks like.
    authLog.warn("sign-in rejected", { reason: "unknown_email" });

    return { message: INVALID_CREDENTIALS, values };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    authLog.warn("sign-in rejected", {
      reason: "wrong_password",
      userId: user.id,
    });

    return { message: INVALID_CREDENTIALS, values };
  }

  await createSession(user.id);

  authLog.info("signed in", { userId: user.id, role: user.role });

  redirect(user.role === "admin" ? AFTER_ADMIN_AUTH : AFTER_AUTH);
}

export async function logout(): Promise<void> {
  await deleteSession();

  authLog.info("signed out");

  redirect("/login");
}

/**
 * Postgres `unique_violation`. Drizzle wraps every driver error in a
 * DrizzleQueryError, so node-postgres's `code` is on `cause`, not the error.
 */
function isUniqueViolation(error: unknown): boolean {
  const pgError = error instanceof Error ? error.cause : undefined;

  return (
    typeof pgError === "object" &&
    pgError !== null &&
    "code" in pgError &&
    pgError.code === "23505"
  );
}
