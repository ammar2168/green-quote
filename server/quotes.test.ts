import { beforeEach, describe, expect, it, vi } from "vitest";

import { findQuote, listQuotes } from "./quotes";

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

const QUOTE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

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

describe("listQuotes", () => {
  it("returns every row, as ordered by the query", async () => {
    state.rows = [{ id: "b" }, { id: "a" }];

    expect(await listQuotes("user-1")).toEqual([{ id: "b" }, { id: "a" }]);
  });
});
