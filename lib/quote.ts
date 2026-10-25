/**
 * The pricing model. Pure functions with no I/O, so the server can compute the
 * quote it saves and the browser can run the same file for a live preview.
 *
 * Money is integer cents (see `lib/money.ts`). The amortization runs in plain
 * doubles and is rounded to the cent once, at the end: nothing here sums
 * rounded values, so there is no error to accumulate and no need for a decimal
 * library.
 */

export const riskBands = ["A", "B", "C"] as const;
export type RiskBand = (typeof riskBands)[number];

/** The three financing terms every quote is offered. */
export const offerTermYears = [5, 10, 15] as const;
export type OfferTermYears = (typeof offerTermYears)[number];

/** $1,200 per kW of system size. */
export const PRICE_PER_KW_CENTS = 1200_00;

/** Base APR for each band, as a percentage — `6.9` means 6.9%. */
export const APR_BY_BAND: Record<RiskBand, number> = {
  A: 6.9,
  B: 8.9,
  C: 11.9,
};

export type QuoteInput = {
  monthlyConsumptionKwh: number;
  systemSizeKw: number;
  downPaymentCents: number;
};

export type QuoteOffer = {
  termYears: OfferTermYears;
  /** Annual percentage rate, as a percentage — `6.9` means 6.9%. */
  apr: number;
  principalUsedCents: number;
  monthlyPaymentCents: number;
};

export type QuoteResult = {
  systemPriceCents: number;
  principalCents: number;
  riskBand: RiskBand;
  apr: number;
  offers: QuoteOffer[];
};

/**
 * systemSizeKw * 1200. Exact for any size with two decimals or fewer, which
 * is all validation lets through — 0.01 kW costs exactly $12.
 */
export function systemPriceCents(systemSizeKw: number): number {
  return Math.round(systemSizeKw * PRICE_PER_KW_CENTS);
}

/**
 * A coarse credit proxy: big consumers on small systems are the safest bet,
 * because the savings comfortably cover the payment.
 */
export function riskBand(
  monthlyConsumptionKwh: number,
  systemSizeKw: number,
): RiskBand {
  if (monthlyConsumptionKwh >= 400 && systemSizeKw <= 6) return "A";
  if (monthlyConsumptionKwh >= 250) return "B";

  return "C";
}

/**
 * The standard amortization formula, P·r / (1 − (1 + r)^−n), with r the
 * monthly rate and n the number of monthly payments.
 *
 * It divides by zero at r = 0. Every band's APR is above zero, so there is no
 * zero-rate branch — the assertion is there so a 0% band added later fails
 * loudly instead of returning NaN.
 */
export function monthlyPaymentCents(
  principalCents: number,
  aprPercent: number,
  termYears: number,
): number {
  if (!(aprPercent > 0)) {
    throw new RangeError(`APR must be above zero, got ${aprPercent}.`);
  }

  const monthlyRate = aprPercent / 100 / 12;
  const payments = termYears * 12;

  return Math.round(
    (principalCents * monthlyRate) / (1 - (1 + monthlyRate) ** -payments),
  );
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const priceCents = systemPriceCents(input.systemSizeKw);
  const principalCents = priceCents - input.downPaymentCents;

  // Request validation rejects this with a field error first. Reaching it
  // means a caller skipped validation, and a quote on nothing is meaningless.
  if (principalCents <= 0) {
    throw new RangeError(
      `Down payment (${input.downPaymentCents}¢) must be less than the system price (${priceCents}¢).`,
    );
  }

  const band = riskBand(input.monthlyConsumptionKwh, input.systemSizeKw);
  const apr = APR_BY_BAND[band];

  return {
    systemPriceCents: priceCents,
    principalCents,
    riskBand: band,
    apr,
    offers: offerTermYears.map((termYears) => ({
      termYears,
      apr,
      principalUsedCents: principalCents,
      monthlyPaymentCents: monthlyPaymentCents(principalCents, apr, termYears),
    })),
  };
}
