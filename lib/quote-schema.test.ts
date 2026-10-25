import { describe, expect, it } from "vitest";

import { fieldErrors } from "./field-errors";
import { quoteRequestSchema } from "./quote-schema";

const VALID = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  address: "12 St James's Square, London",
  monthlyConsumptionKwh: 500,
  systemSizeKw: 5,
  downPayment: 1000,
};

function errorsFor(body: unknown): Record<string, string> {
  const result = quoteRequestSchema.safeParse(body);

  if (result.success) throw new Error("Expected the body to be rejected.");

  return fieldErrors(result.error);
}

describe("quoteRequestSchema", () => {
  it("accepts a valid body and turns the down payment into cents", () => {
    expect(quoteRequestSchema.parse(VALID)).toEqual({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      address: "12 St James's Square, London",
      monthlyConsumptionKwh: 500,
      systemSizeKw: 5,
      downPaymentCents: 100_000,
    });
  });

  it("trims text fields", () => {
    const parsed = quoteRequestSchema.parse({
      ...VALID,
      fullName: "  Ada Lovelace ",
      email: " ada@example.com  ",
    });

    expect(parsed.fullName).toBe("Ada Lovelace");
    expect(parsed.email).toBe("ada@example.com");
  });

  it.each([undefined, null])("treats a %s down payment as none", (value) => {
    const parsed = quoteRequestSchema.parse({ ...VALID, downPayment: value });

    expect(parsed.downPaymentCents).toBe(0);
  });

  it("converts dollars with cents exactly", () => {
    // 19.99 * 100 is 1998.9999999999998 in doubles.
    const parsed = quoteRequestSchema.parse({ ...VALID, downPayment: 19.99 });

    expect(parsed.downPaymentCents).toBe(1_999);
  });

  it("requires every field but the down payment", () => {
    expect(errorsFor({})).toEqual({
      fullName: "Enter your name.",
      email: "Enter your email.",
      address: "Enter the installation address.",
      monthlyConsumptionKwh:
        "Enter your monthly consumption in kWh, as a number.",
      systemSizeKw: "Enter the system size in kW, as a number.",
    });
  });

  it("rejects blank text fields", () => {
    expect(errorsFor({ ...VALID, fullName: "   ", address: "" })).toEqual({
      fullName: "Enter your name.",
      address: "Enter the installation address.",
    });
  });

  it("rejects a malformed email", () => {
    expect(errorsFor({ ...VALID, email: "ada@" })).toEqual({
      email: "Enter a valid email address.",
    });
  });

  it("rejects numbers sent as strings rather than guessing", () => {
    expect(errorsFor({ ...VALID, systemSizeKw: "5" })).toEqual({
      systemSizeKw: "Enter the system size in kW, as a number.",
    });
  });

  it.each([0, -1])("rejects a system size of %s", (systemSizeKw) => {
    expect(errorsFor({ ...VALID, systemSizeKw })).toEqual({
      systemSizeKw: "System size must be more than 0 kW.",
    });
  });

  it("rejects a zero monthly consumption", () => {
    expect(errorsFor({ ...VALID, monthlyConsumptionKwh: 0 })).toEqual({
      monthlyConsumptionKwh: "Monthly consumption must be more than 0 kWh.",
    });
  });

  it("rejects implausibly large values", () => {
    expect(
      errorsFor({ ...VALID, systemSizeKw: 100.01, monthlyConsumptionKwh: 1e6 }),
    ).toEqual({
      systemSizeKw: "System size must be 100 kW or less.",
      monthlyConsumptionKwh: "Monthly consumption must be 100,000 kWh or less.",
    });
  });

  it("rejects more precision than the columns hold", () => {
    expect(
      errorsFor({
        ...VALID,
        systemSizeKw: 5.555,
        monthlyConsumptionKwh: 400.001,
        downPayment: 0.001,
      }),
    ).toEqual({
      systemSizeKw: "Use at most two decimal places.",
      monthlyConsumptionKwh: "Use at most two decimal places.",
      downPayment: "Use whole cents: at most two decimal places.",
    });
  });

  it("rejects a negative down payment", () => {
    expect(errorsFor({ ...VALID, downPayment: -1 })).toEqual({
      downPayment: "Down payment cannot be negative.",
    });
  });

  it.each([6000, 6500])(
    "rejects a down payment of $%s on a $6,000 system",
    (downPayment) => {
      expect(errorsFor({ ...VALID, downPayment })).toEqual({
        downPayment:
          "Down payment must be less than the system price of $6,000.00.",
      });
    },
  );

  it("accepts a down payment one cent under the price", () => {
    const parsed = quoteRequestSchema.parse({ ...VALID, downPayment: 5999.99 });

    expect(parsed.downPaymentCents).toBe(599_999);
  });

  it("reports the down payment alongside unrelated errors", () => {
    expect(errorsFor({ ...VALID, email: "", downPayment: 6000 })).toEqual({
      email: "Enter your email.",
      downPayment:
        "Down payment must be less than the system price of $6,000.00.",
    });
  });

  it("names unknown fields, so a misspelt one is not silently dropped", () => {
    expect(errorsFor({ ...VALID, downpayment: 1000 })).toEqual({
      downpayment: "Not a recognised field.",
    });
  });

  it.each([null, [], "quote", 42])("rejects a body of %j", (body) => {
    const result = quoteRequestSchema.safeParse(body);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: [],
        message: "The request body must be a JSON object.",
      }),
    ]);
  });
});
