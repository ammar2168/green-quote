import { type SQL, and, count, desc, eq, ilike, max } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { type UserRole, quotes, users } from "@/db/schema";
import { type UserFilters, containsPattern } from "@/lib/user-filters";

/**
 * Reads for the admin pages. These do not check the caller's role themselves:
 * every admin page calls `requireAdmin()` before reaching them.
 */

export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  quoteCount: number;
  lastQuoteAt: Date | null;
};

const userColumns = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
};

/**
 * Every user matching the filters, newest sign-up first, with how many quotes
 * each has. Both filters are case-insensitive substring matches, and an empty
 * filter matches everyone.
 */
export async function listUsers(
  filters: UserFilters,
): Promise<AdminUserRow[]> {
  const conditions: SQL[] = [];

  if (filters.name) {
    conditions.push(ilike(users.fullName, containsPattern(filters.name)));
  }

  if (filters.email) {
    conditions.push(ilike(users.email, containsPattern(filters.email)));
  }

  return db
    .select({
      ...userColumns,
      quoteCount: count(quotes.id),
      lastQuoteAt: max(quotes.createdAt),
    })
    .from(users)
    .leftJoin(quotes, eq(quotes.userId, users.id))
    .where(and(...conditions))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt));
}

/** One user by id, or undefined. */
export async function findUser(
  userId: string,
): Promise<Omit<AdminUserRow, "quoteCount" | "lastQuoteAt"> | undefined> {
  // Postgres rejects a malformed uuid with an error rather than no rows.
  if (!z.uuid().safeParse(userId).success) return undefined;

  const [user] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
}
