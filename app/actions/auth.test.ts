import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/password";

import { login, logout } from "./auth";

// The rows the mocked `db.select()...limit()` chain resolves with.
const { selectResult } = vi.hoisted(() => ({
  selectResult: { rows: [] as { id: string; passwordHash: string }[] },
}));

vi.mock("@/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => selectResult.rows,
  };

  return { db: { select: () => chain } };
});

vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

// Like the real one, redirect() ends the action by throwing.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const { createSession, deleteSession } = await import("@/lib/session");
const { redirect } = await import("next/navigation");

const PASSWORD = "correct horse battery";
const USER = { id: "user-1", passwordHash: await hashPassword(PASSWORD) };

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResult.rows = [];
});

describe("login", () => {
  it("signs the user in and redirects to the dashboard", async () => {
    selectResult.rows = [USER];

    await expect(
      login(undefined, form({ email: "a@example.com", password: PASSWORD })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(createSession).toHaveBeenCalledWith(USER.id);
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects a wrong password", async () => {
    selectResult.rows = [USER];

    const state = await login(
      undefined,
      form({ email: "a@example.com", password: "wrong password" }),
    );

    expect(state).toEqual({
      message: "Invalid email or password.",
      values: { email: "a@example.com" },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("gives an unknown email the same message as a wrong password", async () => {
    const state = await login(
      undefined,
      form({ email: "nobody@example.com", password: PASSWORD }),
    );

    expect(state.message).toBe("Invalid email or password.");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects missing fields and echoes the trimmed email", async () => {
    const state = await login(undefined, form({ email: "  a@example.com " }));

    expect(state).toEqual({
      message: "Invalid email or password.",
      values: { email: "a@example.com" },
    });
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("clears the session and redirects to the login page", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");

    expect(deleteSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
