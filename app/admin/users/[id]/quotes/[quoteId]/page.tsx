import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AppHeader } from "@/components/app-header";
import { QuoteBreakdown, QuoteSkeleton } from "@/components/quote-breakdown";
import { SiteFooter } from "@/components/site-chrome";
import { requireAdmin } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { findUser } from "@/server/admin";
import { findQuote } from "@/server/quotes";

export const metadata: Metadata = {
  title: "Quote",
};

/** One user's quote, exactly as they see it, for the admin. */
export default function AdminQuotePage({
  params,
}: PageProps<"/admin/users/[id]/quotes/[quoteId]">) {
  return (
    <>
      <AppHeader current="users" admin />

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
  params: PageProps<"/admin/users/[id]/quotes/[quoteId]">["params"];
}) {
  const [{ id, quoteId }] = await Promise.all([params, requireAdmin()]);
  // The user first: findUser rejects a malformed user id, which findQuote
  // would otherwise hand to Postgres.
  const user = await findUser(id);

  if (!user) notFound();

  // Scoped to the user in the URL, so a quote id under the wrong user is a
  // 404 rather than a page whose breadcrumb names someone else.
  const quote = await findQuote(user.id, quoteId);

  if (!quote) notFound();

  return (
    <div className="flex animate-rise flex-col gap-8">
      <div className="min-w-0">
        <AdminBreadcrumbs
          trail={[
            { href: "/admin/users", label: "Users" },
            { href: `/admin/users/${user.id}`, label: user.fullName },
          ]}
        />
        <p className="mt-3 text-sm text-subtle">
          Quote · {formatQuoteDate(quote.createdAt)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {quote.fullName}
        </h1>
        <p className="mt-1 text-muted">
          {quote.address} · {quote.email}
        </p>
      </div>

      <QuoteBreakdown quote={quote} />
    </div>
  );
}
