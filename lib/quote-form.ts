import type { ApiErrorBody } from "@/server/http";

import { fieldErrors } from "./field-errors";
import type { QuoteResponse } from "./quote-response";
import { quoteRequestSchema } from "./quote-schema";

/**
 * The quote form's side of `POST /api/quotes`: turning what was typed into the
 * request body, checking it with the route's own schema, and turning whatever
 * comes back into something the form can render. No React here, so all of it
 * is testable without a browser.
 */

export type QuoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Record<string, string>; message?: string }
  | { status: "failed"; message: string }
  | { status: "saved"; quote: QuoteResponse };

/**
 * The request body as typed, before validation: a required number may still
 * be missing, which the schema then reports against its field.
 */
export type QuoteFormBody = {
  fullName: string;
  email: string;
  address: string;
  monthlyConsumptionKwh: number | undefined;
  systemSizeKw: number | undefined;
  downPayment: number | null;
};

const GENERIC_FAILURE =
  "We could not save your quote. Check your connection and try again.";

/**
 * Inputs are text, so the numbers are parsed here. An empty box is "not
 * given" rather than 0 — `Number("")` is 0, which would turn a forgotten
 * system size into a "must be more than 0" error instead of "enter a number".
 */
export function toQuoteRequestBody(formData: FormData): QuoteFormBody {
  return {
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    address: text(formData, "address"),
    monthlyConsumptionKwh: number(formData, "monthlyConsumptionKwh"),
    systemSizeKw: number(formData, "systemSizeKw"),
    // Optional: null is the schema's "no down payment".
    downPayment: number(formData, "downPayment") ?? null,
  };
}

/**
 * Validates in the browser first, with exactly the rules the server applies,
 * so a typo is caught without a round trip. The server still checks again.
 */
export async function submitQuote(
  body: QuoteFormBody,
  fetchImpl: typeof fetch = fetch,
): Promise<QuoteFormState> {
  const parsed = quoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return { status: "invalid", errors: fieldErrors(parsed.error) };
  }

  let response: Response;

  try {
    response = await fetchImpl("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "failed", message: GENERIC_FAILURE };
  }

  if (response.status === 201) {
    return { status: "saved", quote: (await response.json()) as QuoteResponse };
  }

  const error = await readApiError(response);

  if (response.status === 401) {
    return {
      status: "failed",
      message: "Your session has ended. Sign in again to save this quote.",
    };
  }

  if (error?.fields) {
    return { status: "invalid", errors: error.fields, message: error.message };
  }

  return { status: "failed", message: error?.message ?? GENERIC_FAILURE };
}

export async function readApiError(
  response: Response,
): Promise<ApiErrorBody["error"] | undefined> {
  try {
    return ((await response.json()) as ApiErrorBody).error;
  } catch {
    // A proxy's HTML error page, say. The generic message covers it.
    return undefined;
  }
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/** Not-a-number text stays NaN, which the schema reports as "as a number". */
function number(formData: FormData, name: string): number | undefined {
  const value = text(formData, name);

  return value === "" ? undefined : Number(value);
}
