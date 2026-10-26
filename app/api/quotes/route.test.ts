import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";

import { POST } from "./route";

// What the route saw: the signed-in user it is given, and every row it saved.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as CurrentUser | null,
    inserted: [] as Record<string, unknown>[],
    insertError: null as Error | null,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => state.user,
}));

// `db.insert(quotes).values(row).returning()` resolves with the row as saved.
vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          if (state.insertError) throw state.insertError;

          state.inserted.push(row);

          return [
            {
              id: "quote-1",
              createdAt: new Date("2026-10-25T12:00:00Z"),
              updatedAt: new Date("2026-10-25T12:00:00Z"),
              ...row,
            },
          ];
        },
      }),
    }),
  },
}));

const USER: CurrentUser = {
  id: "user-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  role: "user",
};

const BODY = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  address: "12 St James's Square, London",
  monthlyConsumptionKwh: 500,
  systemSizeKw: 5,
  downPayment: 1000,
};

function post(
  body: unknown,
  contentType: string | null = "application/json",
): Promise<Response> {
  return POST(
    new Request("http://localhost/api/quotes", {
      method: "POST",
      headers: contentType ? { "content-type": contentType } : {},
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
}

beforeEach(() => {
  state.user = USER;
  state.inserted = [];
  state.insertError = null;
});

describe("POST /api/quotes", () => {
  it("prices, saves and returns the quote", async () => {
    const response = await post(BODY);

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe("/api/quotes/quote-1");
    expect(await response.json()).toEqual({
      id: "quote-1",
      createdAt: "2026-10-25T12:00:00.000Z",
      currency: "USD",
      inputs: {
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        address: "12 St James's Square, London",
        monthlyConsumptionKwh: 500,
        systemSizeKw: 5,
        downPayment: 1000,
      },
      derived: {
        systemPrice: 6000,
        principal: 5000,
        riskBand: "A",
        apr: 6.9,
      },
      offers: [
        { termYears: 5, apr: 6.9, principalUsed: 5000, monthlyPayment: 98.77 },
        { termYears: 10, apr: 6.9, principalUsed: 5000, monthlyPayment: 57.8 },
        { termYears: 15, apr: 6.9, principalUsed: 5000, monthlyPayment: 44.66 },
      ],
    });
  });

  it("saves the inputs and the result in cents, against the user", async () => {
    await post(BODY);

    expect(state.inserted).toEqual([
      {
        userId: "user-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        address: "12 St James's Square, London",
        monthlyConsumptionKwh: 500,
        systemSizeKw: 5,
        downPaymentCents: 100_000,
        systemPriceCents: 600_000,
        principalCents: 500_000,
        riskBand: "A",
        apr: 6.9,
        offers: [
          {
            termYears: 5,
            apr: 6.9,
            principalUsedCents: 500_000,
            monthlyPaymentCents: 9_877,
          },
          {
            termYears: 10,
            apr: 6.9,
            principalUsedCents: 500_000,
            monthlyPaymentCents: 5_780,
          },
          {
            termYears: 15,
            apr: 6.9,
            principalUsedCents: 500_000,
            monthlyPaymentCents: 4_466,
          },
        ],
      },
    ]);
  });

  it("rejects a signed-out caller before reading the body", async () => {
    state.user = null;

    const response = await post("not even json");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Sign in to request a quote." },
    });
    expect(state.inserted).toEqual([]);
  });

  it("rejects a down payment that covers the price, naming the field", async () => {
    const response = await post({ ...BODY, downPayment: 6000 });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "validation_failed",
        message: "Some fields need fixing.",
        fields: {
          downPayment:
            "Down payment must be less than the system price of $6,000.00.",
        },
      },
    });
    expect(state.inserted).toEqual([]);
  });

  it("returns every field error at once", async () => {
    const response = await post({ systemSizeKw: -1 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(Object.keys(body.error.fields).sort()).toEqual([
      "address",
      "email",
      "fullName",
      "monthlyConsumptionKwh",
      "systemSizeKw",
    ]);
  });

  it("rejects a body that is not an object", async () => {
    const response = await post([BODY]);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_body",
        message: "The request body must be a JSON object.",
      },
    });
  });

  it("rejects malformed JSON", async () => {
    const response = await post('{"systemSizeKw": 5,');

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_json");
  });

  it.each([null, "text/plain", "application/x-www-form-urlencoded"])(
    "rejects a content type of %s",
    async (contentType) => {
      const response = await post(BODY, contentType);

      expect(response.status).toBe(415);
      expect((await response.json()).error.code).toBe("unsupported_media_type");
      expect(state.inserted).toEqual([]);
    },
  );

  it("accepts a content type with a charset", async () => {
    const response = await post(BODY, "application/json; charset=utf-8");

    expect(response.status).toBe(201);
  });

  it("answers a database failure in the error shape, without details", async () => {
    state.insertError = new Error("connection refused");
    const logError = vi.spyOn(logger, "error");

    const response = await post(BODY);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong on our side. Please try again.",
      },
    });
    // The details go to the log instead, under the id the response carries.
    expect(response.headers.get("x-request-id")).toEqual(expect.any(String));
    expect(logError).toHaveBeenCalledWith("request failed", {
      status: 500,
      durationMs: expect.any(Number),
      err: state.insertError,
    });
  });
});
