import type { Quote } from "@/db/schema";

import { CURRENCY, fromCents, toCents } from "./money";
import type { OfferTermYears, QuoteOffer, RiskBand } from "./quote";

/**
 * A quote as the API returns it: what was asked, what the pricing model
 * derived from it, and the offers. Money is in US dollars here, converted from
 * the stored cents at this one boundary.
 *
 * This is the contract every client renders from — the app's own pages as
 * much as any outside caller — so it lives in `lib/`, where components can
 * import it without reaching into `server/`.
 */
export type QuoteResponse = {
  id: string;
  /** Whose quote it is: an admin's list mixes every user's. */
  userId: string;
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
  offers: OfferResponse[];
};

export type OfferResponse = {
  termYears: OfferTermYears;
  apr: number;
  principalUsed: number;
  monthlyPayment: number;
};

/**
 * The body of `GET /api/quotes`. An object rather than a bare array, so
 * pagination can be added later without breaking callers.
 */
export type QuoteListResponse = {
  quotes: QuoteResponse[];
};

export function toQuoteResponse(quote: Quote): QuoteResponse {
  return {
    id: quote.id,
    userId: quote.userId,
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

/**
 * An offer from a response back in cents, for the amortization maths. Reading
 * a response is an edge like parsing a request: dollars come in, and anything
 * compared or summed is done in cents.
 */
export function offerFromResponse(offer: OfferResponse): QuoteOffer {
  return {
    termYears: offer.termYears,
    apr: offer.apr,
    principalUsedCents: toCents(offer.principalUsed),
    monthlyPaymentCents: toCents(offer.monthlyPayment),
  };
}
