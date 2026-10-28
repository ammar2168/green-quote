import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { DeleteQuoteButton } from "@/components/delete-quote-button";
import { NewQuoteLink } from "@/components/new-quote-link";
import { QuotesTable, TableSkeleton } from "@/components/quotes-table";
import { SiteFooter } from "@/components/site-chrome";
import { requireCustomer } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { listQuoteResponses } from "@/server/quotes";

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
              <MyQuotes />
            </Suspense>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function MyQuotes() {
  const user = await requireCustomer();
  const quotes = await listQuoteResponses(user.id);

  return (
    <QuotesTable
      quotes={quotes}
      caption="Your quotes"
      quoteHref={(quote) => `/quotes/${quote.id}`}
      rowActions={(quote) => (
        <DeleteQuoteButton
          quoteId={quote.id}
          label={`quote from ${formatQuoteDate(quote.createdAt)}`}
        />
      )}
      empty={
        <>
          <p className="font-semibold">No quotes yet</p>
          <p className="mt-1 text-sm text-muted">
            Request your first pre-qualification and it will be saved here.
          </p>
        </>
      }
    />
  );
}
