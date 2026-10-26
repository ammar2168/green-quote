import type { z } from "zod";

import { fieldErrors } from "@/lib/field-errors";

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

  return Response.json(body, { status });
}

export function validationError(error: z.ZodError): Response {
  const fields = fieldErrors(error);

  // A body that is not an object at all has no field to pin the error on.
  if (Object.keys(fields).length === 0) {
    return apiError(400, "invalid_body", error.issues[0].message);
  }

  return apiError(
    400,
    "validation_failed",
    "Some fields need fixing.",
    fields,
  );
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
 */
export function jsonRoute<Context = unknown>(
  handler: (request: Request, context: Context) => Promise<Response>,
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      const { pathname } = new URL(request.url);

      console.error(`${request.method} ${pathname}`, error);

      return apiError(
        500,
        "internal_error",
        "Something went wrong on our side. Please try again.",
      );
    }
  };
}
