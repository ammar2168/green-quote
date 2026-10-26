import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { type Quote, quotes } from "@/db/schema";
import { CURRENCY, fromCents } from "@/lib/money";
import {
  type OfferTermYears,
  type RiskBand,
  calculateQuote,
} from "@/lib/quote";
import type { QuoteRequest } from "@/lib/quote-schema";

/**
 * A quote as the API returns it: what was asked, what the pricing model
 * derived from it, and the offers. Money is in US dollars here, converted from
 * the stored cents at this one boundary.
 */
export type QuoteResponse = {
  id: string;
  createdAt: string;
  currency: typeof CURRENCY;
  inputs: {
    fullName: string;
    email: string;
    address: string;
    monthlyConsumptionKwh: number;
    systemSizeKw: number;
    downPayment: number;
  };
  derived: {
    systemPrice: number;
    principal: number;
    riskBand: RiskBand;
    apr: number;
  };
  offers: {
    termYears: OfferTermYears;
    apr: number;
    principalUsed: number;
    monthlyPayment: number;
  }[];
};

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

/** The signed-in user's quotes, newest first. */
export async function listQuotes(userId: string): Promise<Quote[]> {
  return db
    .select()
    .from(quotes)
    .where(eq(quotes.userId, userId))
    .orderBy(desc(quotes.createdAt));
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

export function toQuoteResponse(quote: Quote): QuoteResponse {
  return {
    id: quote.id,
    createdAt: quote.createdAt.toISOString(),
    currency: CURRENCY,
    inputs: {
      fullName: quote.fullName,
      email: quote.email,
      address: quote.address,
      monthlyConsumptionKwh: quote.monthlyConsumptionKwh,
      systemSizeKw: quote.systemSizeKw,
      downPayment: fromCents(quote.downPaymentCents),
    },
    derived: {
      systemPrice: fromCents(quote.systemPriceCents),
      principal: fromCents(quote.principalCents),
      riskBand: quote.riskBand,
      apr: quote.apr,
    },
    offers: quote.offers.map((offer) => ({
      termYears: offer.termYears,
      apr: offer.apr,
      principalUsed: fromCents(offer.principalUsedCents),
      monthlyPayment: fromCents(offer.monthlyPaymentCents),
    })),
  };
}
