import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Quote } from "@/db/schema";
import { calculateQuote } from "@/lib/quote";
import { toQuoteResponse } from "@/lib/quote-response";

import { findAnyQuoteResponse, findUser, listAllQuoteResponses } from "./admin";

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
    then: (resolve: (rows: unknown[]) => unknown) => {
      state.queries++;
      return Promise.resolve(state.rows).then(resolve);
    },
  };

  return { db: { select: () => query } };
});

const USER_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

/** A saved quote row belonging to `userId`, as the query would return it. */
function quoteRow(id: string, userId: string): Quote {
  const input = {
    monthlyConsumptionKwh: 500,
    systemSizeKw: 5,
    downPaymentCents: 1000_00,
  };

  return {
    id,
    userId,
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

describe("findUser", () => {
  it("returns the user the query finds", async () => {
    state.rows = [{ id: USER_ID }];

    expect(await findUser(USER_ID)).toEqual({ id: USER_ID });
  });

  it("is undefined when no user matches", async () => {
    expect(await findUser(USER_ID)).toBeUndefined();
  });

  it("does not query for an id that is not a uuid", async () => {
    // Postgres would throw on it, turning a typo'd URL into a 500.
    expect(await findUser("not-a-uuid")).toBeUndefined();
    expect(state.queries).toBe(0);
  });
});

describe("listAllQuoteResponses", () => {
  it("returns every user's quotes as the API answers them", async () => {
    state.rows = [quoteRow("b", "user-2"), quoteRow("a", "user-1")];

    expect(await listAllQuoteResponses()).toEqual([
      toQuoteResponse(quoteRow("b", "user-2")),
      toQuoteResponse(quoteRow("a", "user-1")),
    ]);
  });

  it("matches nobody, without querying, for a userId that is not a uuid", async () => {
    expect(await listAllQuoteResponses({ userId: "not-a-uuid" })).toEqual([]);
    expect(state.queries).toBe(0);
  });
});

describe("findAnyQuoteResponse", () => {
  it("returns any user's quote as the API answers it", async () => {
    state.rows = [quoteRow(USER_ID, "user-2")];

    expect(await findAnyQuoteResponse(USER_ID)).toEqual(
      toQuoteResponse(quoteRow(USER_ID, "user-2")),
    );
  });

  it("is undefined when no quote matches", async () => {
    expect(await findAnyQuoteResponse(USER_ID)).toBeUndefined();
  });
});
