import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { QuoteForm } from "@/components/quote-form";
import { SiteFooter } from "@/components/site-chrome";
import { requireUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "New quote",
};

/** Where sign-up and sign-in land. */
export default function NewQuotePage() {
  return (
    <>
      <AppHeader current="new" />

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
