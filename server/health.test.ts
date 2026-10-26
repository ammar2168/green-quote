import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import { checkDatabase } from "./health";

// How the next `db.execute` behaves: resolve, reject, or never settle.
const { state } = vi.hoisted(() => ({
  state: { outcome: "ok" as "ok" | "fail" | "hang" },
}));

vi.mock("@/db", () => ({
  db: {
    execute: () => {
      if (state.outcome === "fail") {
        return Promise.reject(new Error("ECONNREFUSED 127.0.0.1:5432"));
      }

      if (state.outcome === "hang") return new Promise(() => {});

      return Promise.resolve({ rows: [{ "?column?": 1 }] });
    },
  },
}));

beforeEach(() => {
  state.outcome = "ok";
  vi.spyOn(logger, "error");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("checkDatabase", () => {
  it("is ok, with a latency, when the query answers", async () => {
    const result = await checkDatabase();

    expect(result.status).toBe("ok");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports an error instead of throwing when the query fails", async () => {
    state.outcome = "fail";

    expect(await checkDatabase()).toMatchObject({
      status: "error",
      message: "The database is unreachable.",
    });
  });

  it("keeps driver details out of the result, logging them instead", async () => {
    state.outcome = "fail";

    const result = await checkDatabase();

    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
    expect(logger.error).toHaveBeenCalledWith("health check failed", {
      check: "database",
      err: expect.objectContaining({ message: "ECONNREFUSED 127.0.0.1:5432" }),
    });
  });

  it("gives up with an error when the database never answers", async () => {
    vi.useFakeTimers();
    state.outcome = "hang";

    const pending = checkDatabase(500);

    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).status).toBe("error");
  });
});
