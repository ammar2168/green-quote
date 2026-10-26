import { beforeEach, describe, expect, it, vi } from "vitest";

import { findUser } from "./admin";

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
    limit: () => query,
    then: (resolve: (rows: unknown[]) => unknown) => {
      state.queries++;
      return Promise.resolve(state.rows).then(resolve);
    },
  };

  return { db: { select: () => query } };
});

const USER_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

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
