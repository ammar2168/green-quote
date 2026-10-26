import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseHealth } from "@/server/health";

import { GET } from "./route";

// What the database probe will report, or throw, on the next request.
const { state } = vi.hoisted(() => ({
  state: {
    database: { status: "ok", latencyMs: 3 } as DatabaseHealth,
    probeError: null as Error | null,
  },
}));

vi.mock("next/server", () => ({
  connection: async () => {},
}));

vi.mock("@/server/health", () => ({
  checkDatabase: async () => {
    if (state.probeError) throw state.probeError;

    return state.database;
  },
}));

function get(): Promise<Response> {
  return GET(new Request("http://localhost/api/health"), undefined);
}

beforeEach(() => {
  state.database = { status: "ok", latencyMs: 3 };
  state.probeError = null;
});

describe("GET /api/health", () => {
  it("is 200 with every check ok when the database answers", async () => {
    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      checks: {
        app: { status: "ok" },
        database: { status: "ok", latencyMs: 3 },
      },
    });
    expect(body.checks.app.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("is 503 when the database is unreachable, though the app is up", async () => {
    state.database = {
      status: "error",
      latencyMs: 2_000,
      message: "The database is unreachable.",
    };

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.checks.app.status).toBe("ok");
    expect(body.checks.database).toEqual(state.database);
  });

  it("is never cached, so a stale answer cannot mask an outage", async () => {
    const response = await get();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers a generic 500 if the probe itself blows up", async () => {
    state.probeError = new Error("boom");

    const response = await get();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});
