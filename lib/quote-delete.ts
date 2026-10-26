import { readApiError } from "./quote-form";

/**
 * The delete button's side of `DELETE /api/quotes/:id`. No React here, so it
 * is testable without a browser.
 */

export type DeleteQuoteResult = { ok: true } | { ok: false; message: string };

const GENERIC_FAILURE =
  "We could not delete this quote. Check your connection and try again.";

export async function requestQuoteDeletion(
  quoteId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeleteQuoteResult> {
  let response: Response;

  try {
    response = await fetchImpl(`/api/quotes/${encodeURIComponent(quoteId)}`, {
      method: "DELETE",
    });
  } catch {
    return { ok: false, message: GENERIC_FAILURE };
  }

  // A 404 means it is already gone — deleted in another tab, say — which is
  // what the user asked for.
  if (response.status === 204 || response.status === 404) return { ok: true };

  if (response.status === 401) {
    return {
      ok: false,
      message: "Your session has ended. Sign in again to delete this quote.",
    };
  }

  const error = await readApiError(response);

  return { ok: false, message: error?.message ?? GENERIC_FAILURE };
}
