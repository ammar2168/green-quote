import type { Metadata } from "next";
import { Suspense } from "react";

import { logout } from "@/app/actions/auth";
import { QuoteForm } from "@/components/quote-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { requireUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "New quote",
};

/** Where sign-up and sign-in land. */
export default function NewQuotePage() {
  return (
    <>
      <SiteHeader
        action={
          // Reads the session cookie, so it streams in behind a boundary.
          <Suspense fallback={<div className="h-9 w-40" />}>
            <AccountMenu />
          </Suspense>
        }
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Get your solar pre-qualification
          </h1>
          <p className="mt-2 text-muted">
            Your price, risk band and three installment offers, in a minute.
          </p>

          <div className="mt-6 animate-rise rounded-card border border-line bg-surface p-6 shadow-lift sm:p-8">
            <Suspense fallback={<FormSkeleton />}>
              <PrefilledQuoteForm />
            </Suspense>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function PrefilledQuoteForm() {
  const user = await requireUser();

  return (
    <QuoteForm defaults={{ fullName: user.fullName, email: user.email }} />
  );
}

async function AccountMenu() {
  const user = await requireUser();

  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full bg-panel text-sm font-semibold text-white"
      >
        {user.fullName.charAt(0).toUpperCase()}
      </span>
      <span className="hidden text-sm font-medium sm:inline">
        {user.fullName}
      </span>
      <form action={logout}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <SignOutIcon />
        </button>
      </form>
    </>
  );
}

function SignOutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="h-16 rounded-control bg-sunken" />
        <div className="h-16 rounded-control bg-sunken" />
      </div>
      <div className="h-16 rounded-control bg-sunken" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="h-16 rounded-control bg-sunken" />
        <div className="h-16 rounded-control bg-sunken" />
      </div>
      <div className="h-11 w-48 rounded-control bg-sunken" />
    </div>
  );
}
