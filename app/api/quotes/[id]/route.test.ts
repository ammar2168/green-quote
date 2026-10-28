import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/lib/current-user";
import type { QuoteResponse } from "@/lib/quote-response";

import { DELETE, GET } from "./route";

// What the route saw: the signed-in user it is given, and every read and
// delete it asked for.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as CurrentUser | null,
    exists: true,
    found: [] as { userId: string; quoteId: string }[],
    foundAny: [] as string[],
    deleted: [] as { userId: string; quoteId: string }[],
    deleteError: null as Error | null,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => state.user,
}));

vi.mock("@/server/admin", () => ({
  findAnyQuoteResponse: async (quoteId: string) => {
    state.foundAny.push(quoteId);

    return state.exists ? ({ id: quoteId } as QuoteResponse) : undefined;
  },
}));

vi.mock("@/server/quotes", () => ({
  findQuoteResponse: async (userId: string, quoteId: string) => {
    state.found.push({ userId, quoteId });

    return state.exists ? ({ id: quoteId } as QuoteResponse) : undefined;
  },
  deleteQuote: async (userId: string, quoteId: string) => {
    if (state.deleteError) throw state.deleteError;

    state.deleted.push({ userId, quoteId });

    return state.exists;
  },
}));

const USER: CurrentUser = {
  id: "user-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  role: "user",
};

const QUOTE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

function get(id = QUOTE_ID): Promise<Response> {
  return GET(new Request(`http://localhost/api/quotes/${id}`), {
    params: Promise.resolve({ id }),
  });
}

function del(id = QUOTE_ID): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/quotes/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  state.user = USER;
  state.exists = true;
  state.found = [];
  state.foundAny = [];
  state.deleted = [];
  state.deleteError = null;
});

describe("GET /api/quotes/:id", () => {
  it("returns the signed-in user's quote, looked up as theirs", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: QUOTE_ID });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.found).toEqual([{ userId: "user-1", quoteId: QUOTE_ID }]);
  });

  it("is a 404 when the user has no such quote — missing, or another user's", async () => {
    state.exists = false;

    const response = await get();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "That quote does not exist." },
    });
  });

  it("lets an admin read any user's quote", async () => {
    state.user = { ...USER, id: "admin-1", role: "admin" };

    const response = await get();

    expect(response.status).toBe(200);
    expect(state.foundAny).toEqual([QUOTE_ID]);
    expect(state.found).toEqual([]);
  });

  it("rejects a signed-out caller without looking anything up", async () => {
    state.user = null;

    const response = await get();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Sign in to see this quote." },
    });
    expect(state.found).toEqual([]);
  });
});

describe("DELETE /api/quotes/:id", () => {
  it("deletes the signed-in user's quote, with no body", async () => {
    const response = await del();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(state.deleted).toEqual([{ userId: "user-1", quoteId: QUOTE_ID }]);
  });

  it("is a 404 when the user has no such quote", async () => {
    state.exists = false;

    const response = await del();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "That quote does not exist." },
    });
  });

  it("deletes only the admin's own quotes: admin access is read-only", async () => {
    state.user = { ...USER, id: "admin-1", role: "admin" };

    await del();

    expect(state.deleted).toEqual([{ userId: "admin-1", quoteId: QUOTE_ID }]);
  });

  it("rejects a signed-out caller without deleting anything", async () => {
    state.user = null;

    const response = await del();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
    expect(state.deleted).toEqual([]);
  });

  it("answers a database failure in the error shape, without details", async () => {
    state.deleteError = new Error("connection refused");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await del();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});
