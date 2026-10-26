import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/lib/current-user";

import { DELETE } from "./route";

// What the route saw: the signed-in user it is given, and every delete it asked for.
const { state } = vi.hoisted(() => ({
  state: {
    user: null as CurrentUser | null,
    exists: true,
    deleted: [] as { userId: string; quoteId: string }[],
    deleteError: null as Error | null,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => state.user,
}));

vi.mock("@/server/quotes", () => ({
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

function del(id = QUOTE_ID): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/quotes/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  state.user = USER;
  state.exists = true;
  state.deleted = [];
  state.deleteError = null;
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
