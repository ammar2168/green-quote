import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirectIfSignedIn } from "./current-user";

const { state } = vi.hoisted(() => ({
  state: {
    session: null as { userId: string } | null,
    rows: [] as { id: string; role: "user" | "admin" }[],
  },
}));

vi.mock("@/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => state.rows,
  };

  return { db: { select: () => chain } };
});

vi.mock("@/lib/session", () => ({
  readSession: async () => state.session,
}));

// Like the real one, redirect() ends rendering by throwing.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const { redirect } = await import("next/navigation");

beforeEach(() => {
  vi.clearAllMocks();
  state.session = null;
  state.rows = [];
});

describe("redirectIfSignedIn", () => {
  it("lets a visitor without a session through to the form", async () => {
    await redirectIfSignedIn();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets through a valid session whose user no longer exists", async () => {
    state.session = { userId: "deleted-user" };

    await redirectIfSignedIn();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-in user to the quote form", async () => {
    state.session = { userId: "user-1" };
    state.rows = [{ id: "user-1", role: "user" }];

    await expect(redirectIfSignedIn()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/quotes/new");
  });

  it("sends a signed-in admin to the users list", async () => {
    state.session = { userId: "admin-1" };
    state.rows = [{ id: "admin-1", role: "admin" }];

    await expect(redirectIfSignedIn()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin/users");
  });
});
