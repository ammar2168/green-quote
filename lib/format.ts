/**
 * `26 Oct 2026, 00:20`. Rendered on the server, so the time is in the
 * server's time zone. Takes a `Date` from a row or an ISO string from an API
 * response.
 */
export function formatQuoteDate(date: Date | string): string {
  return new Date(date).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
