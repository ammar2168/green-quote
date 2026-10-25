import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";

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
  return user ?? null;
});

/** For pages that must not render to a signed-out visitor. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return user;
}
