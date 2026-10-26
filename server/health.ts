import { sql } from "drizzle-orm";

import { logger } from "@/lib/logger";

/**
 * A probe that hangs is as bad as one that fails: an orchestrator waiting on
 * it would time out with no answer. Two seconds is far longer than a healthy
 * `select 1` takes, and short enough to report back promptly.
 */
export const DB_PROBE_TIMEOUT_MS = 2_000;

export type DatabaseHealth =
  | { status: "ok"; latencyMs: number }
  | { status: "error"; latencyMs: number; message: string };

/**
 * Round-trips `select 1` through the pool, which proves both that a
 * connection can be checked out and that Postgres answers queries. It never
 * throws: a failure is the result being reported, not an error.
 */
export async function checkDatabase(
  timeoutMs = DB_PROBE_TIMEOUT_MS,
): Promise<DatabaseHealth> {
  const startedAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`No answer within ${timeoutMs} ms.`)),
      timeoutMs,
    );
  });

  try {
    // Imported here rather than at the top: `@/db` throws at load when
    // DATABASE_URL is unset, and a static import would turn that
    // misconfiguration into a bare 500 instead of a reported failure.
    const { db } = await import("@/db");

    await Promise.race([db.execute(sql`select 1`), timeout]);

    return { status: "ok", latencyMs: elapsedSince(startedAt) };
  } catch (error) {
    // Logged in full here; the public response carries only a generic message.
    logger.error("health check failed", { check: "database", err: error });

    return {
      status: "error",
      latencyMs: elapsedSince(startedAt),
      message: "The database is unreachable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function elapsedSince(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
