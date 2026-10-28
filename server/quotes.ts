import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { type Quote, quotes } from "@/db/schema";
import { calculateQuote } from "@/lib/quote";
import { type QuoteResponse, toQuoteResponse } from "@/lib/quote-response";
import type { QuoteRequest } from "@/lib/quote-schema";

/**
 * The quote reads and writes behind the JSON API. Route handlers and pages
 * both read through `listQuoteResponses` / `findQuoteResponse`, so the app's
 * own pages render exactly the JSON an outside client gets from
 * `GET /api/quotes` and `GET /api/quotes/{id}`. The row-level `findQuote` is
 * for server code that needs cents and dates (the PDF).
 */

/**
 * Prices a validated request and saves the inputs and the result together in
 * one insert, so a quote can never exist half-computed.
 */
export async function createQuote(
  userId: string,
  request: QuoteRequest,
): Promise<Quote> {
  const result = calculateQuote(request);

  const [quote] = await db
    .insert(quotes)
    .values({ userId, ...request, ...result })
    .returning();

  return quote;
}

/** The user's quotes as the API returns them, newest first. */
export async function listQuoteResponses(
  userId: string,
): Promise<QuoteResponse[]> {
  const rows = await db
    .select()
    .from(quotes)
    .where(eq(quotes.userId, userId))
    .orderBy(desc(quotes.createdAt));

  return rows.map(toQuoteResponse);
}

/**
 * One of the user's own quotes, or undefined. Another user's quote is
 * undefined too, so its id reveals nothing about whether it exists.
 */
export async function findQuote(
  userId: string,
  quoteId: string,
): Promise<Quote | undefined> {
  // Postgres rejects a malformed uuid with an error rather than no rows.
  if (!z.uuid().safeParse(quoteId).success) return undefined;

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId)))
    .limit(1);

  return quote;
}

/** `findQuote`, as the API returns it. */
export async function findQuoteResponse(
  userId: string,
  quoteId: string,
): Promise<QuoteResponse | undefined> {
  const quote = await findQuote(userId, quoteId);

  return quote && toQuoteResponse(quote);
}

/**
 * Deletes one of the user's own quotes. False when there was nothing of
 * theirs to delete, so — as with `findQuote` — another user's quote id looks
 * exactly like one that does not exist.
 */
export async function deleteQuote(
  userId: string,
  quoteId: string,
): Promise<boolean> {
  if (!z.uuid().safeParse(quoteId).success) return false;

  const deleted = await db
    .delete(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId)))
    .returning({ id: quotes.id });

  return deleted.length > 0;
}
