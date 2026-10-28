import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AppHeader } from "@/components/app-header";
import { QuotesTable, TableSkeleton } from "@/components/quotes-table";
import { SiteFooter } from "@/components/site-chrome";
import { requireAdmin } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { findUser } from "@/server/admin";
import { listQuoteResponses } from "@/server/quotes";

export const metadata: Metadata = {
  title: "User",
};

export default function AdminUserPage({
  params,
}: PageProps<"/admin/users/[id]">) {
  return (
    <>
      <AppHeader current="users" admin />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Reads the session cookie, so it streams in behind a boundary. */}
          <Suspense fallback={<UserSkeleton />}>
            <UserDetails params={params} />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function UserDetails({
  params,
}: {
  params: PageProps<"/admin/users/[id]">["params"];
}) {
  const [{ id }] = await Promise.all([params, requireAdmin()]);
  const user = await findUser(id);

  if (!user) notFound();

  const quotes = await listQuoteResponses(user.id);

  return (
    <div className="animate-rise">
      <AdminBreadcrumbs trail={[{ href: "/admin/users", label: "Users" }]} />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {user.fullName}
        </h1>
        {user.role === "admin" && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
            Admin
          </span>
        )}
      </div>
      <p className="mt-1 text-muted">
        {user.email} · joined {formatQuoteDate(user.createdAt)}
      </p>

      <h2 className="mt-8 text-lg font-semibold">
        Quotes{" "}
        <span className="font-normal text-muted tabular-nums">
          ({quotes.length})
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted">Newest first.</p>

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <QuotesTable
          quotes={quotes}
          caption={`Quotes for ${user.fullName}`}
          quoteHref={(quote) => `/admin/users/${user.id}/quotes/${quote.id}`}
          empty={
            <>
              <p className="font-semibold">No quotes yet</p>
              <p className="mt-1 text-sm text-muted">
                {user.fullName} has not requested a quote.
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}

function UserSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-5 w-16 rounded-control bg-sunken" />
      <div className="mt-2 h-9 w-64 max-w-full rounded-control bg-sunken" />
      <div className="mt-2 h-5 w-80 max-w-full rounded-control bg-sunken" />
      <div className="mt-8 rounded-card border border-line bg-surface">
        <TableSkeleton />
      </div>
    </div>
  );
}
