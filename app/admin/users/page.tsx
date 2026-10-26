import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { Field } from "@/components/field";
import { TableSkeleton } from "@/components/quotes-table";
import {
  SiteFooter,
  primaryButton,
  secondaryButton,
} from "@/components/site-chrome";
import { requireAdmin } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { type UserFilters, parseUserFilters } from "@/lib/user-filters";
import { listUsers } from "@/server/admin";

export const metadata: Metadata = {
  title: "Users",
};

export default function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  return (
    <>
      <AppHeader current="users" admin />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Users
          </h1>
          <p className="mt-2 text-muted">
            Everyone with an account, newest first. Open a user to see their
            quotes.
          </p>

          {/* Reads the session cookie and the query string, so it streams in
              behind a boundary. */}
          <Suspense fallback={<DirectorySkeleton />}>
            <UserDirectory searchParams={searchParams} />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function UserDirectory({
  searchParams,
}: {
  searchParams: PageProps<"/admin/users">["searchParams"];
}) {
  const [filters] = await Promise.all([
    searchParams.then(parseUserFilters),
    requireAdmin(),
  ]);
  const users = await listUsers(filters);
  const filtered = Boolean(filters.name || filters.email);

  return (
    <>
      {/* Keyed by the filters, so clearing them resets what the inputs show. */}
      <div key={`${filters.name}\n${filters.email}`}>
        <FilterForm filters={filters} filtered={filtered} />
      </div>

      <p role="status" className="mt-6 text-sm text-muted">
        {users.length === 1 ? "1 user" : `${users.length} users`}
        {filtered && (users.length === 1 ? " matches" : " match")}
        {filtered && " these filters"}
      </p>

      <div className="mt-2 animate-rise overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {users.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">No users found</p>
            <p className="mt-1 text-sm text-muted">
              {filtered
                ? "Try a shorter name or email, or clear the filters."
                : "Nobody has signed up yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Users</caption>
              <thead className="bg-sunken text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Quotes
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Last quote
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-6">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-canvas"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap sm:px-6">
                      {user.fullName}
                      {user.role === "admin" && (
                        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="max-w-64 truncate px-4 py-3 text-muted">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {user.quoteCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {user.lastQuoteAt ? formatQuoteDate(user.lastQuoteAt) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatQuoteDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-semibold whitespace-nowrap text-brand hover:text-brand-strong"
                      >
                        View<span className="sr-only"> {user.fullName}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * A GET form: submitting navigates to `/admin/users?name=…&email=…`, so the
 * filtered list is a plain URL.
 */
function FilterForm({
  filters,
  filtered,
}: {
  filters: UserFilters;
  filtered: boolean;
}) {
  return (
    <Form
      action="/admin/users"
      role="search"
      aria-label="Filter users"
      className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5"
    >
      <Field
        label="Name"
        name="name"
        type="search"
        placeholder="e.g. Ada"
        defaultValue={filters.name}
        autoComplete="off"
      />
      <Field
        label="Email"
        name="email"
        type="search"
        placeholder="e.g. ada@example.com"
        defaultValue={filters.email}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <button type="submit" className={`${primaryButton} flex-1`}>
          Filter
        </button>
        {filtered && (
          <Link href="/admin/users" className={`${secondaryButton} py-2.5`}>
            Clear
          </Link>
        )}
      </div>
    </Form>
  );
}

function DirectorySkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="mt-6 h-24 rounded-card bg-sunken" />
      <div className="mt-6 h-5 w-24 rounded-control bg-sunken" />
      <div className="mt-2 rounded-card border border-line bg-surface">
        <TableSkeleton />
      </div>
    </div>
  );
}
