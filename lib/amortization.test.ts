import { describe, expect, it } from "vitest";

import {
  amortizationSchedule,
  totalInterestCents,
  yearlySchedule,
} from "./amortization";
import { monthlyPaymentCents } from "./quote";

// 43,000.00 over 10 years at 11.9%: band C with 48,000 price and 5,000 down.
const PRINCIPAL = 4_300_000;
const APR = 11.9;
const PAYMENT = monthlyPaymentCents(PRINCIPAL, APR, 10);

describe("amortizationSchedule", () => {
  const months = amortizationSchedule(PRINCIPAL, APR, 10, PAYMENT);

  it("has one row per monthly payment", () => {
    expect(PAYMENT).toBe(61_444);
    expect(months).toHaveLength(120);
    expect(months.map((row) => row.period)).toEqual(
      Array.from({ length: 120 }, (_, i) => i + 1),
    );
  });

  it("charges a month's interest on the balance, rounded to the cent", () => {
    // 4,300,000 × 0.119 / 12 = 42,641.67
    expect(months[0]).toEqual({
      period: 1,
      paidCents: 61_444,
      principalCents: 61_444 - 42_642,
      interestCents: 42_642,
      balanceCents: PRINCIPAL - (61_444 - 42_642),
    });
  });

  it("adds up on every row and ends at exactly zero", () => {
    let balance = PRINCIPAL;

    for (const row of months) {
      expect(row.principalCents + row.interestCents).toBe(row.paidCents);
      expect(balance - row.principalCents).toBe(row.balanceCents);
      balance = row.balanceCents;
    }

    expect(balance).toBe(0);
  });

  it("pays the scheduled amount every month but the last, which is within cents", () => {
    for (const row of months.slice(0, -1)) expect(row.paidCents).toBe(PAYMENT);

    expect(Math.abs(months[119].paidCents - PAYMENT)).toBeLessThan(100);
  });

  it("shifts from mostly interest to mostly principal", () => {
    expect(months[0].interestCents).toBeGreaterThan(months[0].principalCents);
    expect(months[119].principalCents).toBeGreaterThan(
      months[119].interestCents,
    );
  });
});

describe("yearlySchedule", () => {
  const months = amortizationSchedule(PRINCIPAL, APR, 10, PAYMENT);
  const years = yearlySchedule(months);

  it("groups twelve payments to a year", () => {
    expect(years).toHaveLength(10);
    expect(years[0]).toEqual({
      period: 1,
      paidCents: 737_328,
      principalCents: 238_349,
      interestCents: 498_979,
      balanceCents: 4_061_651,
    });
    expect(years[9].balanceCents).toBe(0);
  });

  it("keeps the totals of the months it groups", () => {
    expect(totalInterestCents(years)).toBe(totalInterestCents(months));
    expect(years.reduce((sum, y) => sum + y.principalCents, 0)).toBe(PRINCIPAL);
  });
});
