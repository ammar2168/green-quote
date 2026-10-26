import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { setLogContext } from "@/lib/logger";

import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  role: "user" | "admin";
};

/**
 * The signed-in user, or null. Wrapped in React's `cache` so a layout, a page
 * and a Server Component can each ask without running the query three times in
 * one request.
 *
 * The row is re-read every request rather than trusted from the cookie, which
 * is what keeps `role` honest — see the note in `lib/session.ts`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();

  if (!session) return null;

  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  // A valid cookie for a deleted user, which is a signed-out user.
  if (!user) return null;

  // Every later log line in this request then says whose request it was.
  setLogContext({ userId: user.id, role: user.role });

  return user;
});

/** For pages that must not render to a signed-out visitor. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return user;
}

/**
 * For admin-only pages. A signed-in non-admin gets a 404 rather than a 403, so
 * the admin pages do not announce that they exist.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();

  if (user.role !== "admin") notFound();

  return user;
}
