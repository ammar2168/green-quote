/**
 * `26 Oct 2026, 00:20`. Rendered on the server, so the time is in the
 * server's time zone.
 */
export function formatQuoteDate(date: Date): string {
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
