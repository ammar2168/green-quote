import { describe, expect, it } from "vitest";

import {
  calculateQuote,
  monthlyPaymentCents,
  riskBand,
  systemPriceCents,
} from "./quote";

// Expected payments were worked out independently with 50-digit decimal
// arithmetic, then rounded to the cent, so these check the formula rather than
// restate it.

describe("systemPriceCents", () => {
  it("charges $1,200 per kW", () => {
    expect(systemPriceCents(5)).toBe(600_000);
    expect(systemPriceCents(7)).toBe(840_000);
  });

  it("is exact for sizes that are not exact in binary", () => {
    // 4.35 * 120000 is 521999.99999999994 in doubles.
    expect(systemPriceCents(4.35)).toBe(522_000);
    expect(systemPriceCents(0.01)).toBe(1_200);
  });
});

describe("riskBand", () => {
  it("is A for high consumption on a small system", () => {
    expect(riskBand(400, 6)).toBe("A");
    expect(riskBand(1000, 3)).toBe("A");
  });

  it("is B when consumption is high but the system is over 6 kW", () => {
    expect(riskBand(400, 6.01)).toBe("B");
  });

  it("is B from 250 kWh up to just under 400", () => {
    expect(riskBand(250, 4)).toBe("B");
    expect(riskBand(399.99, 4)).toBe("B");
  });

  it("is C below 250 kWh, whatever the system size", () => {
    expect(riskBand(249.99, 4)).toBe("C");
    expect(riskBand(100, 10)).toBe("C");
  });
});

describe("monthlyPaymentCents", () => {
  it("matches the amortization formula, rounded to the cent", () => {
    expect(monthlyPaymentCents(600_000, 6.9, 5)).toBe(11_852);
    expect(monthlyPaymentCents(600_000, 6.9, 10)).toBe(6_936);
    expect(monthlyPaymentCents(600_000, 6.9, 15)).toBe(5_359);
  });

  it("refuses a zero APR rather than dividing by zero", () => {
    expect(() => monthlyPaymentCents(600_000, 0, 5)).toThrow(RangeError);
  });
});

describe("calculateQuote", () => {
  it("prices a band A quote with all three offers", () => {
    expect(
      calculateQuote({
        monthlyConsumptionKwh: 500,
        systemSizeKw: 5,
        downPaymentCents: 0,
      }),
    ).toEqual({
      systemPriceCents: 600_000,
      principalCents: 600_000,
      riskBand: "A",
      apr: 6.9,
      offers: [
        {
          termYears: 5,
          apr: 6.9,
          principalUsedCents: 600_000,
          monthlyPaymentCents: 11_852,
        },
        {
          termYears: 10,
          apr: 6.9,
          principalUsedCents: 600_000,
          monthlyPaymentCents: 6_936,
        },
        {
          termYears: 15,
          apr: 6.9,
          principalUsedCents: 600_000,
          monthlyPaymentCents: 5_359,
        },
      ],
    });
  });

  it("finances only what the down payment leaves", () => {
    const quote = calculateQuote({
      monthlyConsumptionKwh: 500,
      systemSizeKw: 5,
      downPaymentCents: 100_000,
    });

    expect(quote.systemPriceCents).toBe(600_000);
    expect(quote.principalCents).toBe(500_000);
    expect(quote.offers.map((offer) => offer.principalUsedCents)).toEqual([
      500_000, 500_000, 500_000,
    ]);
    expect(quote.offers.map((offer) => offer.monthlyPaymentCents)).toEqual([
      9_877, 5_780, 4_466,
    ]);
  });

  it("uses the band B rate", () => {
    const quote = calculateQuote({
      monthlyConsumptionKwh: 500,
      systemSizeKw: 7,
      downPaymentCents: 0,
    });

    expect(quote.riskBand).toBe("B");
    expect(quote.apr).toBe(8.9);
    expect(quote.offers.map((offer) => offer.monthlyPaymentCents)).toEqual([
      17_396, 10_595, 8_470,
    ]);
  });

  it("uses the band C rate", () => {
    const quote = calculateQuote({
      monthlyConsumptionKwh: 100,
      systemSizeKw: 7,
      downPaymentCents: 0,
    });

    expect(quote.riskBand).toBe("C");
    expect(quote.apr).toBe(11.9);
    expect(quote.offers.map((offer) => offer.monthlyPaymentCents)).toEqual([
      18_643, 12_003, 10_027,
    ]);
  });

  it("refuses a down payment that covers the whole price", () => {
    const input = { monthlyConsumptionKwh: 500, systemSizeKw: 5 };

    expect(() =>
      calculateQuote({ ...input, downPaymentCents: 600_000 }),
    ).toThrow(RangeError);
    expect(() =>
      calculateQuote({ ...input, downPaymentCents: 700_000 }),
    ).toThrow(RangeError);
  });
});
