import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { QuotesTable, TableSkeleton } from "@/components/quotes-table";
import { SiteFooter } from "@/components/site-chrome";
import { requireAdmin } from "@/lib/current-user";
import { listAllQuoteResponses } from "@/server/admin";

export const metadata: Metadata = {
  title: "All user quotes",
};

/**
 * The admin's home: every user's quotes in one list, read through the same
 * service as `GET /api/quotes` answers an admin with.
 */
export default function AdminQuotesPage() {
  return (
    <>
      <AppHeader current="all-quotes" admin />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            All user quotes
          </h1>
          <p className="mt-2 text-muted">
            Every pre-qualification any user has requested, newest first.
          </p>

          {/* Reads the session cookie, so it streams in behind a boundary. */}
          <Suspense fallback={<QuotesSkeleton />}>
            <AllQuotes />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function AllQuotes() {
  await requireAdmin();
  const quotes = await listAllQuoteResponses();

  return (
    <>
      <p role="status" className="mt-6 text-sm text-muted">
        {quotes.length === 1 ? "1 quote" : `${quotes.length} quotes`}
      </p>

      <div className="mt-2 animate-rise overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <QuotesTable
          quotes={quotes}
          caption="Every user's quotes"
          showCustomer
          quoteHref={(quote) =>
            `/admin/users/${quote.userId}/quotes/${quote.id}`
          }
          empty={
            <>
              <p className="font-semibold">No quotes yet</p>
              <p className="mt-1 text-sm text-muted">
                Quotes appear here as soon as any user requests one.
              </p>
            </>
          }
        />
      </div>
    </>
  );
}

function QuotesSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="mt-6 h-5 w-24 rounded-control bg-sunken" />
      <div className="mt-2 rounded-card border border-line bg-surface">
        <TableSkeleton />
      </div>
    </div>
  );
}
