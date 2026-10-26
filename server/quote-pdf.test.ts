import { describe, expect, it } from "vitest";

import { calculateQuote } from "@/lib/quote";

import { resolvePdfOffer } from "./quote-pdf";

const { offers } = calculateQuote({
  monthlyConsumptionKwh: 100,
  systemSizeKw: 10,
  downPaymentCents: 0,
});

describe("resolvePdfOffer", () => {
  it("is the 10-year offer, as on the page, when no term is given", () => {
    expect(resolvePdfOffer(offers, null)?.termYears).toBe(10);
  });

  it.each(["5", "10", "15"])("finds the %s-year offer", (term) => {
    expect(resolvePdfOffer(offers, term)?.termYears).toBe(Number(term));
  });

  it.each(["", "7", "10.0", "1e1", " 10", "-5", "ten", "0x0a", "0010"])(
    "is undefined for %j",
    (term) => {
      expect(resolvePdfOffer(offers, term)).toBeUndefined();
    },
  );
});
