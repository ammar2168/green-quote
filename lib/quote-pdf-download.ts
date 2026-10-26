import { readApiError } from "./quote-form";

/**
 * The download button's side of `GET /api/quotes/:id/pdf`. Fetched rather
 * than followed as a plain link, so a failure (an expired session, a quote
 * deleted in another tab) shows as a message beside the button instead of
 * replacing the page with a JSON error. No React here, so it is testable
 * without a browser.
 */

export type QuotePdfResult =
  { ok: true; blob: Blob; filename: string } | { ok: false; message: string };

const GENERIC_FAILURE =
  "We could not create the PDF. Check your connection and try again.";

export async function requestQuotePdf(
  quoteId: string,
  termYears: number,
  fetchImpl: typeof fetch = fetch,
): Promise<QuotePdfResult> {
  let response: Response;

  try {
    response = await fetchImpl(
      `/api/quotes/${encodeURIComponent(quoteId)}/pdf?term=${termYears}`,
    );
  } catch {
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (response.status === 401) {
    return {
      ok: false,
      message: "Your session has ended. Sign in again to download this quote.",
    };
  }

  if (response.status === 404) {
    return { ok: false, message: "This quote no longer exists." };
  }

  if (!response.ok) {
    const error = await readApiError(response);

    return { ok: false, message: error?.message ?? GENERIC_FAILURE };
  }

  let blob: Blob;

  try {
    blob = await response.blob();
  } catch {
    // The connection dropped part-way through the body.
    return { ok: false, message: GENERIC_FAILURE };
  }

  // A proxy or a login page answering 200 in its place is not a PDF.
  if (!blob.type.startsWith("application/pdf") || blob.size === 0) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  return {
    ok: true,
    blob,
    filename:
      filenameFrom(response.headers.get("content-disposition")) ??
      `greenquote-quote-${termYears}-years.pdf`,
  };
}

/** The `filename="…"` of a Content-Disposition header, if it has one. */
export function filenameFrom(header: string | null): string | undefined {
  const match = header?.match(/filename="([^"]+)"/i);

  return match?.[1];
}
