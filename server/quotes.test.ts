import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Quote } from "@/db/schema";
import { calculateQuote } from "@/lib/quote";
import { toQuoteResponse } from "@/lib/quote-response";

import {
  deleteQuote,
  findQuote,
  findQuoteResponse,
  listQuoteResponses,
} from "./quotes";

// What the next query resolves with, and how many queries actually ran.
const { state } = vi.hoisted(() => ({
  state: { rows: [] as unknown[], queries: 0 },
}));

// `db.select().from().where()…` is thenable at every step, like Drizzle's
// builder, so it resolves wherever the code stops chaining.
vi.mock("@/db", () => {
  const query = {
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    returning: () => query,
    then: (resolve: (rows: unknown[]) => unknown) => {
      state.queries++;
      return Promise.resolve(state.rows).then(resolve);
    },
  };

  return { db: { select: () => query, delete: () => query } };
});

const QUOTE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

/** A saved quote row, as the query would return it. */
function quoteRow(id: string): Quote {
  const input = {
    monthlyConsumptionKwh: 500,
    systemSizeKw: 5,
    downPaymentCents: 1000_00,
  };

  return {
    id,
    userId: "user-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    address: "12 St James's Square, London",
    ...input,
    ...calculateQuote(input),
    createdAt: new Date("2026-10-25T12:00:00Z"),
    updatedAt: new Date("2026-10-25T12:00:00Z"),
  };
}

beforeEach(() => {
  state.rows = [];
  state.queries = 0;
});

describe("findQuote", () => {
  it("returns the quote the query finds", async () => {
    state.rows = [{ id: QUOTE_ID }];

    expect(await findQuote("user-1", QUOTE_ID)).toEqual({ id: QUOTE_ID });
  });

  it("is undefined when no quote matches — missing, or another user's", async () => {
    expect(await findQuote("user-1", QUOTE_ID)).toBeUndefined();
  });

  it("does not query for an id that is not a uuid", async () => {
    // Postgres would throw on it, turning a typo'd URL into a 500.
    expect(await findQuote("user-1", "not-a-uuid")).toBeUndefined();
    expect(state.queries).toBe(0);
  });
});

describe("findQuoteResponse", () => {
  it("returns the quote as the API answers it", async () => {
    state.rows = [quoteRow(QUOTE_ID)];

    expect(await findQuoteResponse("user-1", QUOTE_ID)).toEqual(
      toQuoteResponse(quoteRow(QUOTE_ID)),
    );
  });

  it("is undefined when no quote matches — missing, or another user's", async () => {
    expect(await findQuoteResponse("user-1", QUOTE_ID)).toBeUndefined();
  });

  it("does not query for an id that is not a uuid", async () => {
    expect(await findQuoteResponse("user-1", "not-a-uuid")).toBeUndefined();
    expect(state.queries).toBe(0);
  });
});

describe("listQuoteResponses", () => {
  it("returns every row as the API answers it, in the query's order", async () => {
    state.rows = [quoteRow("b"), quoteRow("a")];

    const quotes = await listQuoteResponses("user-1");

    expect(quotes.map((quote) => quote.id)).toEqual(["b", "a"]);
    expect(quotes[0]).toEqual(toQuoteResponse(quoteRow("b")));
  });

  it("is empty when the user has no quotes", async () => {
    expect(await listQuoteResponses("user-1")).toEqual([]);
  });
});

describe("deleteQuote", () => {
  it("is true when the query deleted the quote", async () => {
    state.rows = [{ id: QUOTE_ID }];

    expect(await deleteQuote("user-1", QUOTE_ID)).toBe(true);
  });

  it("is false when nothing matched — missing, or another user's", async () => {
    expect(await deleteQuote("user-1", QUOTE_ID)).toBe(false);
  });

  it("does not query for an id that is not a uuid", async () => {
    expect(await deleteQuote("user-1", "not-a-uuid")).toBe(false);
    expect(state.queries).toBe(0);
  });
});
