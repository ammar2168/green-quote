import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Quote } from "@/db/schema";
import type { CurrentUser } from "@/lib/current-user";
import { calculateQuote } from "@/lib/quote";

import { GET } from "./route";

// The signed-in user, the quotes that exist, and which lookup the route used.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as CurrentUser | null,
    quotes: [] as Quote[],
    lookups: [] as string[],
    findError: null as Error | null,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => state.user,
}));

vi.mock("@/server/quotes", () => ({
  findQuote: async (userId: string, quoteId: string) => {
    state.lookups.push("findQuote");

    if (state.findError) throw state.findError;

    return state.quotes.find(
      (quote) => quote.id === quoteId && quote.userId === userId,
    );
  },
}));

vi.mock("@/server/admin", () => ({
  findAnyQuote: async (quoteId: string) => {
    state.lookups.push("findAnyQuote");

    return state.quotes.find((quote) => quote.id === quoteId);
  },
}));

const USER: CurrentUser = {
  id: "user-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  role: "user",
};

const ADMIN: CurrentUser = { ...USER, id: "admin-1", role: "admin" };

const QUOTE_ID = "d793187e-c228-413f-bad6-24e769f85162";

const input = {
  monthlyConsumptionKwh: 100,
  systemSizeKw: 10,
  downPaymentCents: 500_000,
};

const QUOTE: Quote = {
  id: QUOTE_ID,
  userId: "user-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  address: "12 St James's Square, London",
  ...input,
  ...calculateQuote(input),
  createdAt: new Date("2026-10-26T00:36:00Z"),
  updatedAt: new Date("2026-10-26T00:36:00Z"),
};

function get(query = "", id = QUOTE_ID): Promise<Response> {
  return GET(new Request(`http://localhost/api/quotes/${id}/pdf${query}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  state.user = USER;
  state.quotes = [QUOTE];
  state.lookups = [];
  state.findError = null;
});

describe("GET /api/quotes/:id/pdf", () => {
  it("uses the 10-year offer when no term is given", async () => {
    const response = await get();

    expect(response.headers.get("content-disposition")).toContain(
      "-10-years.pdf",
    );
  });

  it("rejects a term the quote has no offer for", async () => {
    const response = await get("?term=7");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_term",
        message: "Choose a term of 5, 10 or 15 years.",
      },
    });
  });

  it("rejects a signed-out caller", async () => {
    state.user = null;

    const response = await get();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
    expect(state.lookups).toEqual([]);
  });

  it("is a 404 for another user's quote, as for a missing one", async () => {
    state.user = { ...USER, id: "user-2" };

    const response = await get();

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
    expect(state.lookups).toEqual(["findQuote"]);
  });

  it("is a 404 for a malformed id", async () => {
    const response = await get("", "not-a-uuid");

    expect(response.status).toBe(404);
  });

  it("lets an admin download any user's quote", async () => {
    state.user = ADMIN;

    const response = await get();

    expect(response.status).toBe(200);
    expect(state.lookups).toEqual(["findAnyQuote"]);
  });

  it("answers an unexpected failure in the standard error shape", async () => {
    state.findError = new Error("connection refused");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await get();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});
