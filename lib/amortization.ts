/**
 * How an offer is repaid, payment by payment. Pure, like `lib/quote.ts`, so
 * the quote page can build it in the browser from the saved offer.
 *
 * Unlike the payment itself, the schedule rounds every month: each payment's
 * interest is rounded to the cent, as a lender would bill it, and the balance
 * carries exact cents from one month to the next. Every row therefore adds up
 * (principal + interest = paid, and the balances fall by exactly the
 * principal), and the last payment absorbs the few cents of drift so the loan
 * ends at zero.
 */

export type AmortizationRow = {
  /** 1-based: month 1 is the first payment. */
  period: number;
  paidCents: number;
  principalCents: number;
  interestCents: number;
  /** What is still owed after this payment. */
  balanceCents: number;
};

export function amortizationSchedule(
  principalCents: number,
  aprPercent: number,
  termYears: number,
  monthlyPaymentCents: number,
): AmortizationRow[] {
  const monthlyRate = aprPercent / 100 / 12;
  const payments = termYears * 12;
  const rows: AmortizationRow[] = [];

  let balanceCents = principalCents;

  for (let period = 1; period <= payments; period++) {
    const interestCents = Math.round(balanceCents * monthlyRate);
    const principalPartCents =
      period === payments ? balanceCents : monthlyPaymentCents - interestCents;

    balanceCents -= principalPartCents;

    rows.push({
      period,
      paidCents: principalPartCents + interestCents,
      principalCents: principalPartCents,
      interestCents,
      balanceCents,
    });
  }

  return rows;
}

/** Twelve monthly rows to a year, numbered from 1. */
export function yearlySchedule(months: AmortizationRow[]): AmortizationRow[] {
  const years: AmortizationRow[] = [];

  for (let start = 0; start < months.length; start += 12) {
    const year = months.slice(start, start + 12);

    years.push({
      period: years.length + 1,
      paidCents: sum(year, "paidCents"),
      principalCents: sum(year, "principalCents"),
      interestCents: sum(year, "interestCents"),
      balanceCents: year[year.length - 1].balanceCents,
    });
  }

  return years;
}

export function totalInterestCents(rows: AmortizationRow[]): number {
  return sum(rows, "interestCents");
}

function sum(
  rows: AmortizationRow[],
  key: "paidCents" | "principalCents" | "interestCents",
): number {
  return rows.reduce((total, row) => total + row[key], 0);
}
