import { connection } from "next/server";

import { checkDatabase } from "@/server/health";
import { jsonRoute } from "@/server/http";

/**
 * Reports whether the app is up and can reach its database, for load
 * balancers, uptime monitors and container health checks.
 *
 * 200 when every check passes; 503 when the database is unreachable, so a
 * probe that only reads the status code still takes the instance out of
 * rotation. Public by design (a probe has no session), so the body carries
 * no versions, hostnames or error details.
 */
export const GET = jsonRoute(async () => {
  // Otherwise Cache Components would prerender this at build time and serve
  // a frozen "ok" forever.
  await connection();

  const database = await checkDatabase();
  const healthy = database.status === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "error",
      timestamp: new Date().toISOString(),
      checks: {
        app: {
          status: "ok",
          uptimeSeconds: Math.round(process.uptime()),
        },
        database,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
});
