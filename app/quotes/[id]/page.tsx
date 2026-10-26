import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { NewQuoteLink } from "@/components/new-quote-link";
import { QuoteBreakdown, QuoteSkeleton } from "@/components/quote-breakdown";
import { SiteFooter } from "@/components/site-chrome";
import { requireUser } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { findQuote } from "@/server/quotes";

export const metadata: Metadata = {
  title: "Your quote",
};

/** Where the quote form lands, and where "My quotes" links to. */
export default function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  return (
    <>
      <AppHeader current="quotes" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Reads the session cookie, so it streams in behind a boundary. */}
          <Suspense fallback={<QuoteSkeleton />}>
            <QuoteDetails params={params} />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function QuoteDetails({
  params,
}: {
  params: PageProps<"/quotes/[id]">["params"];
}) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const quote = await findQuote(user.id, id);

  if (!quote) notFound();

  return (
    <div className="flex animate-rise flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-subtle">
            Quote · {formatQuoteDate(quote.createdAt)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {quote.fullName}
          </h1>
          <p className="mt-1 text-muted">{quote.address}</p>
        </div>
        <NewQuoteLink />
      </div>

      <QuoteBreakdown quote={quote} />
    </div>
  );
}
