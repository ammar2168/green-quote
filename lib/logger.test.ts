import { describe, expect, it, vi } from "vitest";

import {
  createLogger,
  parseNextLine,
  requestIdFrom,
  routeConsoleToLogger,
  routeStreamToLogger,
  serialiseError,
  setLogContext,
  withLogContext,
} from "./logger";

const NOW = new Date("2026-03-01T09:30:15.123Z");

function capture(
  options: { level?: "debug" | "info" | "silent"; pretty?: boolean } = {},
) {
  const lines: string[] = [];
  const logger = createLogger({
    level: options.level ?? "debug",
    format: options.pretty ? "pretty" : "json",
    write: (line) => lines.push(line),
    now: () => NOW,
  });

  return {
    logger,
    lines,
    events: () => lines.map((line) => JSON.parse(line)),
  };
}

describe("createLogger", () => {
  it("writes one JSON line per event, with time, level, message and fields", () => {
    const { logger, lines } = capture();

    logger.info("quote created", { quoteId: "q1" });

    expect(lines).toEqual([
      '{"time":"2026-03-01T09:30:15.123Z","level":"info","msg":"quote created","quoteId":"q1"}\n',
    ]);
  });

  it("drops events below the configured level, and everything when silent", () => {
    const info = capture({ level: "info" });
    const silent = capture({ level: "silent" });

    for (const { logger } of [info, silent]) {
      logger.debug("noise");
      logger.error("broken");
    }

    expect(info.events().map((event) => event.msg)).toEqual(["broken"]);
    expect(silent.lines).toEqual([]);
  });

  it("adds a child's fields to every line, letting call-site fields win", () => {
    const { logger, events } = capture();
    const child = logger.child({ source: "auth", userId: "u1" });

    child.warn("sign-in rejected", { userId: "u2" });

    expect(events()[0]).toMatchObject({ source: "auth", userId: "u2" });
  });

  it("serialises an err field instead of logging {}", () => {
    const { logger, events } = capture();

    logger.error("request failed", { err: new TypeError("bad") });

    expect(events()[0].err).toMatchObject({
      name: "TypeError",
      message: "bad",
      stack: expect.stringContaining("TypeError: bad"),
    });
  });

  it("still writes a line when a field cannot be serialised", () => {
    const { logger, events } = capture();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.info("odd", { circular });

    expect(events()[0]).toMatchObject({
      msg: "odd",
      logError: "fields could not be serialised",
    });
  });

  it("prints a readable line with any stack beneath it in pretty format", () => {
    const { logger, lines } = capture({ pretty: true });
    const err = new Error("boom");

    logger.info("request completed", { status: 201, path: "/api/quotes" });
    logger.error("request failed", { note: "two words", err });

    expect(lines[0]).toBe(
      "09:30:15.123 INFO  request completed  status=201 path=/api/quotes\n",
    );
    expect(lines[1]).toBe(
      `09:30:15.123 ERROR request failed  note="two words"\n${err.stack}\n`,
    );
  });
});

describe("withLogContext", () => {
  it("attaches its fields, and later setLogContext ones, to every line inside", async () => {
    const { logger, events } = capture();

    await withLogContext({ requestId: "r1" }, async () => {
      logger.info("first");
      await Promise.resolve();
      setLogContext({ userId: "u1" });
      logger.info("second");
    });
    logger.info("outside");

    expect(events()).toMatchObject([
      { msg: "first", requestId: "r1" },
      { msg: "second", requestId: "r1", userId: "u1" },
      { msg: "outside" },
    ]);
    expect(events()[2]).not.toHaveProperty("requestId");
  });

  it("keeps concurrent requests' fields apart", async () => {
    const { logger, events } = capture();
    const request = (id: string) =>
      withLogContext({ requestId: id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        setLogContext({ userId: `user-${id}` });
        logger.info("done");
      });

    await Promise.all([request("a"), request("b")]);

    expect(
      events()
        .map(({ requestId, userId }) => `${requestId}:${userId}`)
        .sort(),
    ).toEqual(["a:user-a", "b:user-b"]);
  });

  it("ignores setLogContext outside a request", () => {
    expect(() => setLogContext({ userId: "u1" })).not.toThrow();
  });
});

describe("requestIdFrom", () => {
  it("reuses a plain incoming x-request-id", () => {
    expect(requestIdFrom(new Headers({ "x-request-id": "edge-123.4" }))).toBe(
      "edge-123.4",
    );
  });

  it("makes a fresh id when none is sent, or the sent one is not plain", () => {
    const uuid = /^[0-9a-f-]{36}$/;

    expect(requestIdFrom(new Headers())).toMatch(uuid);
    expect(
      requestIdFrom(new Headers({ "x-request-id": '"},"level":"x' })),
    ).toMatch(uuid);
    expect(
      requestIdFrom(new Headers({ "x-request-id": "a".repeat(129) })),
    ).toMatch(uuid);
  });
});

describe("serialiseError", () => {
  it("follows the cause chain, keeping the Postgres code Drizzle hides there", () => {
    const pgError = Object.assign(new Error("duplicate key"), {
      code: "23505",
      detail: "Key (email) already exists.",
    });
    const wrapped = new Error("Failed query", { cause: pgError });

    expect(serialiseError(wrapped)).toMatchObject({
      message: "Failed query",
      cause: {
        message: "duplicate key",
        code: "23505",
        detail: "Key (email) already exists.",
      },
    });
  });

  it("keeps the digest Next.js shows on a production error page", () => {
    const error = Object.assign(new Error("render"), { digest: "123456" });

    expect(serialiseError(error)).toMatchObject({ digest: "123456" });
  });

  it("passes a thrown non-error through unchanged", () => {
    expect(serialiseError("just a string")).toBe("just a string");
  });
});

describe("routeConsoleToLogger", () => {
  function fakeConsole() {
    return { ...console } as Console;
  }

  it("turns console output into log lines at the matching level, without colours", () => {
    const { logger, events } = capture();
    const target = fakeConsole();

    routeConsoleToLogger(logger.child({ source: "next" }), target);
    target.log(" \u001b[32mGET\u001b[39m /quotes %d in 34ms", 200);
    target.warn("⚠ slow");

    expect(events()).toMatchObject([
      { level: "info", msg: "GET /quotes 200 in 34ms", source: "next" },
      { level: "warn", msg: "⚠ slow", source: "next" },
    ]);
  });

  it("logs an Error argument as the structured err field", () => {
    const { logger, events } = capture();
    const target = fakeConsole();

    routeConsoleToLogger(logger, target);
    target.error(new Error("render failed"));

    expect(events()[0]).toMatchObject({
      level: "error",
      msg: "render failed",
      err: { message: "render failed" },
    });
  });
});

describe("parseNextLine", () => {
  it("reads a dev request line into the fields jsonRoute logs", () => {
    expect(
      parseNextLine(
        " GET /quotes \u001b[32m200\u001b[39m in 1.5s\u001b[2m (next.js: 3ms, application-code: 1.4s)\u001b[22m",
      ),
    ).toEqual({
      level: "info",
      msg: "request completed",
      fields: {
        method: "GET",
        path: "/quotes",
        status: 200,
        durationMs: 1500,
        timings: "next.js: 3ms, application-code: 1.4s",
      },
    });
  });

  it("raises the level with the status", () => {
    expect(parseNextLine("GET /nope 404 in 38ms")?.level).toBe("warn");
    expect(parseNextLine("GET /quotes/1 500 in 38ms")?.level).toBe("error");
  });

  it("keeps any other line as the message, and skips blank ones", () => {
    expect(parseNextLine("○ Compiling / ...", "warn")).toEqual({
      level: "warn",
      msg: "○ Compiling / ...",
    });
    expect(parseNextLine("  \u001b[2m\u001b[22m ")).toBeUndefined();
  });
});

describe("routeStreamToLogger", () => {
  it("logs each complete line, buffering a partial write until its newline", () => {
    const { logger, events } = capture();
    const stream = { write: () => true } as unknown as NodeJS.WriteStream;
    const done = vi.fn();

    routeStreamToLogger(stream, logger, "info");
    stream.write("GET / 200 in 5ms\nhalf a ");
    stream.write("line\n", done);

    expect(events()).toMatchObject([
      { msg: "request completed", path: "/", status: 200 },
      { msg: "half a line" },
    ]);
    expect(done).toHaveBeenCalled();
  });
});
