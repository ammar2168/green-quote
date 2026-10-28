import type { z } from "zod";

import { fieldErrors } from "@/lib/field-errors";
import {
  logger,
  requestIdFrom,
  setLogContext,
  withLogContext,
} from "@/lib/logger";

/**
 * Plumbing shared by the JSON route handlers. Every error leaves in one shape,
 * so a client needs exactly one error handler:
 *
 *   { "error": { "code": "validation_failed", "message": "…", "fields": { … } } }
 *
 * `fields` is present only for validation errors, keyed by request field.
 */

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

/**
 * For a response carrying one user's data: no shared cache may keep it, and a
 * browser must not show it again after sign-out.
 */
export const PRIVATE_NO_STORE = "private, no-store";

/** Far more than any quote needs; anything bigger is not a real request. */
const MAX_BODY_BYTES = 16 * 1024;

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): Response {
  const body: ApiErrorBody = {
    error: { code, message, ...(fields && { fields }) },
  };

  // So the request's log line says why it was refused, not just the status.
  setLogContext({
    errorCode: code,
    ...(fields && { invalidFields: Object.keys(fields) }),
  });

  return Response.json(body, { status });
}

export function validationError(error: z.ZodError): Response {
  const fields = fieldErrors(error);

  // A body that is not an object at all has no field to pin the error on.
  if (Object.keys(fields).length === 0) {
    return apiError(400, "invalid_body", error.issues[0].message);
  }

  return apiError(400, "validation_failed", "Some fields need fixing.", fields);
}

/**
 * Parses a JSON request body, or explains why it could not.
 *
 * Insisting on `application/json` doubles as a CSRF guard: a form on another
 * site can only post form encodings, and a cross-site `fetch` with this
 * content type needs a CORS preflight that this app never answers.
 */
export async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (mediaType !== "application/json") {
    return {
      ok: false,
      response: apiError(
        415,
        "unsupported_media_type",
        "Send the request body as application/json.",
      ),
    };
  }

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: apiError(
        413,
        "body_too_large",
        "The request body is too large.",
      ),
    };
  }

  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError(
        400,
        "invalid_json",
        "The request body is not valid JSON.",
      ),
    };
  }
}

/**
 * Wraps a route handler so an unexpected failure still answers in the error
 * shape above, rather than Next.js's empty 500, and without leaking details.
 *
 * It also logs one line per request — method, path, status, duration, the
 * user and any error code — under a request id that every log line inside the
 * handler shares and that the response returns as `x-request-id`, so a user's
 * report of a failure can be matched to its log lines.
 */
export function jsonRoute<Context = unknown>(
  handler: (request: Request, context: Context) => Promise<Response>,
): (request: Request, context: Context) => Promise<Response> {
  return (request, context) => {
    const requestId = requestIdFrom(request.headers);
    const { pathname } = new URL(request.url);

    return withLogContext(
      { requestId, method: request.method, path: pathname },
      async () => {
        const startedAt = performance.now();
        let response: Response;
        let failure: unknown;

        try {
          response = await handler(request, context);
        } catch (error) {
          failure = error;
          response = apiError(
            500,
            "internal_error",
            "Something went wrong on our side. Please try again.",
          );
        }

        const fields = {
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
          ...(failure !== undefined && { err: failure }),
        };

        if (response.status >= 500) {
          logger.error("request failed", fields);
        } else if (response.status >= 400) {
          logger.warn("request rejected", fields);
        } else {
          logger.info("request completed", fields);
        }

        try {
          response.headers.set("x-request-id", requestId);
        } catch {
          // Some responses (Response.redirect) have immutable headers.
        }

        return response;
      },
    );
  };
}
