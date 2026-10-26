import { AsyncLocalStorage } from "node:async_hooks";
import { format, stripVTControlCharacters } from "node:util";

/**
 * Structured server logging. Every line is one event: a short `msg` plus
 * fields, so logs can be filtered by `requestId`, `userId`, `status` and so on
 * instead of grepped as prose.
 *
 *   {"time":"…","level":"info","msg":"request completed","requestId":"…",
 *    "method":"POST","path":"/api/quotes","status":201,"durationMs":42}
 *
 * Fields set with `withLogContext` / `setLogContext` ride along on every line
 * logged while that request runs, however deep the call that logs it, which is
 * what lets one request be traced end to end.
 *
 * Output is JSON lines unless `LOG_FORMAT=pretty` (the default under
 * `next dev`). Everything goes to stdout, the same stream Next.js's own
 * output is routed to by `instrumentation.ts`, so there is one place to look.
 * Server-only: it needs Node's `async_hooks`.
 */

export const logLevels = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof logLevels)[number];

export type LogFields = Record<string, unknown>;

export type Logger = Record<
  LogLevel,
  (msg: string, fields?: LogFields) => void
> & {
  /** A logger that adds `fields` to every line, e.g. `{ source: "next" }`. */
  child(fields: LogFields): Logger;
};

/** `silent` turns logging off, which the test run uses. */
type Threshold = LogLevel | "silent";

type LoggerOptions = {
  level: Threshold;
  format: "json" | "pretty";
  write: (line: string) => void;
  now: () => Date;
};

/**
 * Process-wide state, kept on `globalThis` because Next.js bundles this module
 * more than once (instrumentation, each route) and every copy must share one
 * request context and the real stdout. `write` is bound before
 * `routeNextOutputToLogger` replaces `process.stdout.write`; going through the
 * replacement would log each line twice over.
 */
const shared = ((globalThis as { [key: symbol]: unknown })[
  Symbol.for("greenquote.logger")
] ??= {
  requestContext: new AsyncLocalStorage<LogFields>(),
  writeStdout: process.stdout.write.bind(process.stdout),
  routed: false,
}) as {
  requestContext: AsyncLocalStorage<LogFields>;
  writeStdout: (line: string) => boolean;
  routed: boolean;
};

const { requestContext } = shared;

/**
 * Runs `fn` with `fields` attached to every line it logs. Nested calls see the
 * outer fields too.
 */
export function withLogContext<T>(fields: LogFields, fn: () => T): T {
  return requestContext.run({ ...requestContext.getStore(), ...fields }, fn);
}

/**
 * Adds fields to the current request's context once they are known, such as
 * `userId` after the session is read. A no-op outside `withLogContext`.
 */
export function setLogContext(fields: LogFields): void {
  const store = requestContext.getStore();

  if (store) Object.assign(store, fields);
}

const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

/**
 * The caller's `x-request-id` when a proxy in front already assigned one, so
 * its logs and ours share the id; otherwise a fresh one. An incoming value is
 * only trusted if it is short and plain, since it is echoed into every line.
 */
export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get("x-request-id");

  return incoming && REQUEST_ID_PATTERN.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

/**
 * The parts of an error worth keeping. `JSON.stringify(error)` gives `{}`,
 * and Drizzle hides the Postgres `code` and `detail` on `cause`, so the chain
 * is followed too. `digest` is how Next.js ties a production error page to
 * this log line.
 */
export function serialiseError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) return error;

  const extra = error as Error & Record<string, unknown>;

  return {
    name: error.name,
    message: error.message,
    ...(typeof extra.code === "string" && { code: extra.code }),
    ...(typeof extra.digest === "string" && { digest: extra.digest }),
    ...(typeof extra.detail === "string" && { detail: extra.detail }),
    stack: error.stack,
    ...(error.cause !== undefined &&
      depth < 3 && { cause: serialiseError(error.cause, depth + 1) }),
  };
}

const LEVEL_RANK: Record<Threshold, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: Infinity,
};

export function createLogger(
  options: LoggerOptions,
  bound: LogFields = {},
): Logger {
  const threshold = LEVEL_RANK[options.level];

  function log(level: LogLevel, msg: string, fields: LogFields = {}) {
    if (LEVEL_RANK[level] < threshold) return;

    const event: LogFields = {
      time: options.now().toISOString(),
      level,
      msg,
      ...requestContext.getStore(),
      ...bound,
      ...fields,
    };

    if (event.err !== undefined) event.err = serialiseError(event.err);

    options.write(
      options.format === "json" ? toJsonLine(event) : toPrettyLine(event),
    );
  }

  return {
    debug: (msg, fields) => log("debug", msg, fields),
    info: (msg, fields) => log("info", msg, fields),
    warn: (msg, fields) => log("warn", msg, fields),
    error: (msg, fields) => log("error", msg, fields),
    child: (fields) => createLogger(options, { ...bound, ...fields }),
  };
}

function toJsonLine(event: LogFields): string {
  try {
    return JSON.stringify(event) + "\n";
  } catch {
    // A circular or BigInt field must not take the request down with it.
    return (
      JSON.stringify({
        time: event.time,
        level: event.level,
        msg: event.msg,
        logError: "fields could not be serialised",
      }) + "\n"
    );
  }
}

/** One readable line for the terminal, with any stack trace beneath it. */
function toPrettyLine(event: LogFields): string {
  const { time, level, msg, err, ...fields } = event;
  const clock = String(time).slice(11, 23);
  const pairs = Object.entries(fields)
    .map(([key, value]) => `${key}=${prettyValue(value)}`)
    .join(" ");
  const stack =
    err && typeof err === "object" && "stack" in err
      ? `\n${String(err.stack)}`
      : err !== undefined
        ? ` err=${prettyValue(err)}`
        : "";

  return `${clock} ${String(level).toUpperCase().padEnd(5)} ${msg}${pairs && `  ${pairs}`}${stack}\n`;
}

function prettyValue(value: unknown): string {
  if (typeof value === "string") {
    return /\s/.test(value) ? JSON.stringify(value) : value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function readLevel(value: string | undefined): Threshold {
  const level = value?.toLowerCase();

  if (level === "silent") return level;

  return logLevels.find((candidate) => candidate === level) ?? "info";
}

/** The app's logger, configured from `LOG_LEVEL` and `LOG_FORMAT`. */
export const logger = createLogger({
  level: readLevel(process.env.LOG_LEVEL),
  format:
    (process.env.LOG_FORMAT ??
      (process.env.NODE_ENV === "development" ? "pretty" : "json")) === "pretty"
      ? "pretty"
      : "json",
  write: (line) => shared.writeStdout(line),
  now: () => new Date(),
});

const CONSOLE_LEVELS = {
  debug: "debug",
  log: "info",
  info: "info",
  warn: "warn",
  error: "error",
} as const satisfies Partial<Record<keyof Console, LogLevel>>;

/**
 * Sends everything written through `console` — Next.js's warnings and render
 * errors, and any stray `console.log` — through `target`, so it lands in the
 * same stream and shape as the app's logs. ANSI colours are stripped, and an
 * `Error` argument becomes the structured `err` field.
 */
export function routeConsoleToLogger(
  target: Logger,
  console: Console = globalThis.console,
): void {
  for (const [method, level] of Object.entries(CONSOLE_LEVELS)) {
    console[method as keyof typeof CONSOLE_LEVELS] = (...args: unknown[]) => {
      const err = args.find((arg) => arg instanceof Error);
      const rest = args.filter((arg) => arg !== err);
      const msg =
        stripVTControlCharacters(format(...rest)).trim() ||
        (err instanceof Error ? err.message : "");

      // Next.js prints blank lines as spacing, which mean nothing in a log.
      if (!msg) return;

      target[level](msg, err === undefined ? undefined : { err });
    };
  }
}

type ParsedLine = { level: LogLevel; msg: string; fields?: LogFields };

const NEXT_REQUEST_LINE =
  /^([A-Z]+) (\S+) (\d{3}) in ([\d.]+)(ms|s|min)\b(?: \((.*)\))?/;

const MS_PER_UNIT = { ms: 1, s: 1000, min: 60_000 } as const;

/**
 * Reads one line of Next.js's own output. Its dev request line,
 * `GET /quotes 200 in 34ms (next.js: 3ms, application-code: 31ms)`, becomes
 * the same fields `jsonRoute` logs, so page and API requests can be queried
 * alike; anything else is kept as the message.
 */
export function parseNextLine(
  raw: string,
  fallback: LogLevel = "info",
): ParsedLine | undefined {
  const line = stripVTControlCharacters(raw).trim();

  if (!line) return undefined;

  const request = NEXT_REQUEST_LINE.exec(line);

  if (!request) return { level: fallback, msg: line };

  const [, method, path, statusText, amount, unit, timings] = request;
  const status = Number(statusText);

  return {
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    msg: "request completed",
    fields: {
      method,
      path,
      status,
      durationMs: Math.round(
        Number(amount) * MS_PER_UNIT[unit as keyof typeof MS_PER_UNIT],
      ),
      ...(timings && { timings }),
    },
  };
}

/**
 * Like `routeConsoleToLogger`, for output written straight to a stream, which
 * is how Next.js prints its request lines. Partial writes are buffered until
 * the line is complete.
 */
export function routeStreamToLogger(
  stream: NodeJS.WriteStream,
  target: Logger,
  level: LogLevel,
): void {
  let pending = "";

  stream.write = ((chunk: unknown, ...rest: unknown[]) => {
    pending += typeof chunk === "string" ? chunk : String(chunk);

    const lines = pending.split("\n");

    pending = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseNextLine(line, level);

      if (parsed) target[parsed.level](parsed.msg, parsed.fields);
    }

    const callback = rest.find((arg) => typeof arg === "function");

    if (callback) (callback as () => void)();

    return true;
  }) as NodeJS.WriteStream["write"];
}

/**
 * Puts Next.js's own output in the same stream and shape as the app's logs,
 * tagged `source: "next"`. Next.js writes warnings and render errors (and the
 * browser logs `logging.browserToTerminal` forwards) through `console`, but
 * its dev request lines straight to stdout, so both are routed. Idempotent,
 * since `register()` runs again after a dev-server restart in-process.
 */
export function routeNextOutputToLogger(): void {
  if (shared.routed) return;

  shared.routed = true;

  const next = logger.child({ source: "next" });

  routeConsoleToLogger(next);
  routeStreamToLogger(process.stdout, next, "info");
  routeStreamToLogger(process.stderr, next, "warn");
}
