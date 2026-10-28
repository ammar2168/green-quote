import { type SQL, and, count, desc, eq, ilike, max } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { type Quote, type UserRole, quotes, users } from "@/db/schema";
import { type QuoteResponse, toQuoteResponse } from "@/lib/quote-response";
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
export async function listUsers(filters: UserFilters): Promise<AdminUserRow[]> {
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

/**
 * Any user's quote by id, or undefined. Only for an admin: the user-facing
 * equivalent is `findQuote`, which is scoped to its owner.
 */
export async function findAnyQuote(
  quoteId: string,
): Promise<Quote | undefined> {
  if (!z.uuid().safeParse(quoteId).success) return undefined;

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  return quote;
}

/** `findAnyQuote`, as the API returns it. */
export async function findAnyQuoteResponse(
  quoteId: string,
): Promise<QuoteResponse | undefined> {
  const quote = await findAnyQuote(quoteId);

  return quote && toQuoteResponse(quote);
}

/**
 * Every user's quotes as the API returns them, newest first, or only one
 * user's when `userId` is given. Only for an admin: the user-facing
 * equivalent is `listQuoteResponses`, which is scoped to its owner.
 */
export async function listAllQuoteResponses({
  userId,
}: { userId?: string } = {}): Promise<QuoteResponse[]> {
  // A malformed id matches nobody, and Postgres would throw on it.
  if (userId !== undefined && !z.uuid().safeParse(userId).success) return [];

  const rows = await db
    .select()
    .from(quotes)
    .where(userId === undefined ? undefined : eq(quotes.userId, userId))
    .orderBy(desc(quotes.createdAt));

  return rows.map(toQuoteResponse);
}
