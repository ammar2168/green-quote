import type { Instrumentation } from "next";

/**
 * Puts Next.js's own output in the same place, and the same shape, as the
 * app's logs (`lib/logger.ts`): one stream of structured lines on stdout.
 *
 * The logger is imported lazily and only for the Node.js runtime, since this
 * file is also compiled for the edge runtime, which has no `async_hooks`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { routeNextOutputToLogger } = await import("@/lib/logger");

  routeNextOutputToLogger();
}

/**
 * Errors Next.js caught itself: thrown while rendering a page, in a Server
 * Action, or in a route handler that is not wrapped in `jsonRoute`. The
 * `digest` is the reference a production error page shows, so a user's
 * screenshot leads straight to this line.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("@/lib/logger");
  const requestId = request.headers["x-request-id"];

  logger.error("unhandled server error", {
    source: "next",
    ...(typeof requestId === "string" && { requestId }),
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    err: error,
  });
};
