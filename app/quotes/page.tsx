import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { NewQuoteLink } from "@/components/new-quote-link";
import { SiteFooter } from "@/components/site-chrome";
import { requireUser } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { listQuotes } from "@/server/quotes";

export const metadata: Metadata = {
  title: "My quotes",
};

export default function MyQuotesPage() {
  return (
    <>
      <AppHeader current="quotes" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                My quotes
              </h1>
              <p className="mt-2 text-muted">
                Every pre-qualification you have requested, newest first.
              </p>
            </div>
            <NewQuoteLink />
          </div>

          <div className="mt-6 animate-rise overflow-hidden rounded-card border border-line bg-surface shadow-card">
            {/* Reads the session cookie, so it streams in behind a boundary. */}
            <Suspense fallback={<TableSkeleton />}>
              <QuotesTable />
            </Suspense>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function QuotesTable() {
  const user = await requireUser();
  const quotes = await listQuotes(user.id);

  if (quotes.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-semibold">No quotes yet</p>
        <p className="mt-1 text-sm text-muted">
          Request your first pre-qualification and it will be saved here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Your quotes</caption>
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
                <Link
                  href={`/quotes/${quote.id}`}
                  className="font-semibold whitespace-nowrap text-brand hover:text-brand-strong"
                >
                  View<span className="sr-only"> quote from {formatQuoteDate(quote.createdAt)}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-3 p-6">
      <div className="h-6 rounded-control bg-sunken" />
      <div className="h-6 rounded-control bg-sunken" />
      <div className="h-6 rounded-control bg-sunken" />
    </div>
  );
}
