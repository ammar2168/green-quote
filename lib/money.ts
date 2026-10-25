/**
 * Money is integer US cents wherever it is stored, compared or added up, so
 * those values are always exact. Fractions of a cent exist only inside a
 * calculation (see `monthlyPaymentCents` in `lib/quote.ts`), and are rounded
 * away before the result leaves it.
 *
 * Dollars appear only at the edges: parsing a request and writing a response.
 */

export const CURRENCY = "USD";

/** `12.34` → `1234`. Assumes at most two decimals, which validation enforces. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** `1234` → `12.34`. Exact to the cent, since every cent count is an integer. */
export function fromCents(cents: number): number {
  return cents / 100;
}
