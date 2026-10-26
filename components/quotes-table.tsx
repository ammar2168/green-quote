import Link from "next/link";
import type { ReactNode } from "react";

import type { Quote } from "@/db/schema";
import { formatQuoteDate } from "@/lib/format";
import { formatCents } from "@/lib/money";

/**
 * A list of quotes, newest first as given. Shared by "My quotes" and the
 * admin's view of one user, which differ only in where a row links to.
 */
export function QuotesTable({
  quotes,
  caption,
  quoteHref,
  rowActions,
  empty,
}: {
  quotes: Quote[];
  caption: string;
  quoteHref: (quoteId: string) => string;
  /** Extra controls beside "View" — only the owner's own list has any. */
  rowActions?: (quote: Quote) => ReactNode;
  /** Shown instead of the table when there are no quotes. */
  empty: ReactNode;
}) {
  if (quotes.length === 0) {
    return <div className="px-6 py-16 text-center">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sunken text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium sm:px-6">
              Date
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Address
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              System size
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Price
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Band
            </th>
            <th scope="col" className="px-4 py-3 sm:px-6">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {quotes.map((quote) => (
            <tr key={quote.id} className="transition-colors hover:bg-canvas">
              <td className="px-4 py-3 whitespace-nowrap sm:px-6">
                {formatQuoteDate(quote.createdAt)}
              </td>
              <td className="max-w-64 truncate px-4 py-3 text-muted">
                {quote.address}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {quote.systemSizeKw} kW
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {formatCents(quote.systemPriceCents, { wholeDollars: true })}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {quote.riskBand}{" "}
                <span className="text-muted">· {quote.apr}% APR</span>
              </td>
              <td className="px-4 py-3 text-right sm:px-6">
                <div className="flex items-center justify-end gap-4">
                  <Link
                    href={quoteHref(quote.id)}
                    className="font-semibold whitespace-nowrap text-brand hover:text-brand-strong"
                  >
                    View
                    <span className="sr-only">
                      {" "}
                      quote from {formatQuoteDate(quote.createdAt)}
                    </span>
                  </Link>
                  {rowActions?.(quote)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-3 p-6">
      <div className="h-6 rounded-control bg-sunken" />
      <div className="h-6 rounded-control bg-sunken" />
      <div className="h-6 rounded-control bg-sunken" />
    </div>
  );
}
