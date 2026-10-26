import { describe, expect, it, vi } from "vitest";

import {
  type QuoteFormBody,
  submitQuote,
  toQuoteRequestBody,
} from "./quote-form";

const BODY: QuoteFormBody = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  address: "12 St James's Square, London",
  monthlyConsumptionKwh: 500,
  systemSizeKw: 5,
  downPayment: null,
};

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }

  return formData;
}

/** A fetch that answers every call with this status and JSON body. */
function respondWith(status: number, body: unknown) {
  return vi.fn(async () => Response.json(body, { status }));
}

describe("toQuoteRequestBody", () => {
  it("trims text and parses numbers", () => {
    expect(
      toQuoteRequestBody(
        form({
          fullName: " Ada Lovelace ",
          email: "ada@example.com",
          address: "12 St James's Square, London",
          monthlyConsumptionKwh: "500",
          systemSizeKw: " 5.5 ",
          downPayment: "1000",
        }),
      ),
    ).toEqual({ ...BODY, systemSizeKw: 5.5, downPayment: 1000 });
  });

  it("treats empty numbers as not given, not as 0", () => {
    expect(
      toQuoteRequestBody(
        form({ monthlyConsumptionKwh: "", systemSizeKw: "", downPayment: "" }),
      ),
    ).toMatchObject({
      monthlyConsumptionKwh: undefined,
      systemSizeKw: undefined,
      downPayment: null,
    });
  });
});

describe("submitQuote", () => {
  it("posts the body as JSON and returns the saved quote", async () => {
    const quote = { id: "quote-1" };
    const fetchImpl = respondWith(201, quote);

    expect(await submitQuote(BODY, fetchImpl)).toEqual({
      status: "saved",
      quote,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(BODY),
    });
  });

  it("reports field errors without calling the API", async () => {
    const fetchImpl = respondWith(201, {});

    const state = await submitQuote(
      { ...BODY, address: "", systemSizeKw: undefined },
      fetchImpl,
    );

    expect(state).toEqual({
      status: "invalid",
      errors: {
        address: "Enter the installation address.",
        systemSizeKw: "Enter the system size in kW, as a number.",
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports text typed into a number field", async () => {
    const state = await submitQuote(
      { ...BODY, monthlyConsumptionKwh: Number("lots") },
      respondWith(201, {}),
    );

    expect(state).toMatchObject({
      errors: {
        monthlyConsumptionKwh:
          "Enter your monthly consumption in kWh, as a number.",
      },
    });
  });

  it("shows the server's field errors", async () => {
    const state = await submitQuote(
      BODY,
      respondWith(400, {
        error: {
          code: "validation_failed",
          message: "Some fields need fixing.",
          fields: { email: "Enter a valid email address." },
        },
      }),
    );

    expect(state).toEqual({
      status: "invalid",
      errors: { email: "Enter a valid email address." },
      message: "Some fields need fixing.",
    });
  });

  it("asks a signed-out user to sign in again", async () => {
    const state = await submitQuote(
      BODY,
      respondWith(401, {
        error: { code: "unauthorized", message: "Sign in to request a quote." },
      }),
    );

    expect(state).toEqual({
      status: "failed",
      message: "Your session has ended. Sign in again to save this quote.",
    });
  });

  it("falls back to a generic message when the server or network fails", async () => {
    const generic = {
      status: "failed",
      message:
        "We could not save your quote. Check your connection and try again.",
    };

    expect(
      await submitQuote(
        BODY,
        vi.fn(
          async () => new Response("<html>Bad gateway</html>", { status: 502 }),
        ),
      ),
    ).toEqual(generic);
    expect(
      await submitQuote(
        BODY,
        vi.fn(async () => {
          throw new TypeError("Failed to fetch");
        }),
      ),
    ).toEqual(generic);
  });
});
