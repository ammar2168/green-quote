import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { NewQuoteLink } from "@/components/new-quote-link";
import { QuoteOffers } from "@/components/quote-offers";
import { SiteFooter } from "@/components/site-chrome";
import { requireUser } from "@/lib/current-user";
import { formatQuoteDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import {
  APR_BY_BAND,
  PRICE_PER_KW_CENTS,
  type RiskBand,
} from "@/lib/quote";
import { findQuote } from "@/server/quotes";

export const metadata: Metadata = {
  title: "Your quote",
};

const BAND_MEANING: Record<RiskBand, string> = {
  A: "Band A means 400 kWh or more a month on a system of 6 kW or less.",
  B: "Band B means 250 kWh or more a month, without band A's 400 kWh on 6 kW or less.",
  C: "Band C means under 250 kWh a month.",
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

      <section
        aria-labelledby="band-heading"
        className="flex gap-4 rounded-card border border-emerald-200 bg-emerald-50 p-5 sm:p-6"
      >
        <CheckBadgeIcon />
        <div>
          <h2
            id="band-heading"
            className="flex flex-wrap items-center gap-2 font-semibold sm:text-lg"
          >
            Pre-qualified: risk band {quote.riskBand}
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
              {quote.apr}% APR
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {BAND_MEANING[quote.riskBand]} Choose one of the three installment
            offers below to see how it is repaid.
          </p>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label="System price"
          value={formatCents(quote.systemPriceCents, { wholeDollars: true })}
          note={`${quote.systemSizeKw} kW × ${formatCents(PRICE_PER_KW_CENTS, { wholeDollars: true })}`}
        />
        <Stat
          label="Down payment"
          value={formatCents(quote.downPaymentCents, { wholeDollars: true })}
          note="paid upfront"
        />
        <Stat
          label="To finance"
          value={formatCents(quote.principalCents, { wholeDollars: true })}
          note="price − down payment"
        />
        <Stat
          label="Monthly consumption"
          value={`${quote.monthlyConsumptionKwh} kWh`}
          note={`${quote.systemSizeKw} kW system`}
        />
      </dl>

      <QuoteOffers offers={quote.offers} />

      <details className="group rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <summary className="cursor-pointer font-semibold">
          How this quote is calculated
        </summary>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
          <li>
            <strong className="text-ink">System price</strong> is the system
            size times {formatCents(PRICE_PER_KW_CENTS, { wholeDollars: true })}{" "}
            per kW.
          </li>
          <li>
            <strong className="text-ink">To finance</strong> (the principal) is
            the system price minus your down payment.
          </li>
          <li>
            <strong className="text-ink">Risk band</strong> is A for 400 kWh or
            more a month on a system of 6 kW or less, otherwise B for 250 kWh or
            more, otherwise C. The APR follows the band: A {APR_BY_BAND.A}%, B{" "}
            {APR_BY_BAND.B}%, C {APR_BY_BAND.C}%.
          </li>
          <li>
            <strong className="text-ink">Monthly payment</strong> uses the
            standard amortization formula, P·r / (1 − (1 + r)<sup>−n</sup>),
            where P is the principal, r the APR divided by 12 and n the number
            of monthly payments.
          </li>
          <li>
            <strong className="text-ink">The schedule</strong> charges each
            month&apos;s interest on what is still owed, rounded to the cent;
            the rest of the payment pays down the balance. The last payment
            settles the final few cents.
          </li>
        </ul>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-1 text-xs text-subtle sm:text-sm">{note}</dd>
    </div>
  );
}

function CheckBadgeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-8 shrink-0 text-emerald-700"
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function QuoteSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-8">
      <div className="h-20 w-80 max-w-full rounded-control bg-sunken" />
      <div className="h-24 rounded-card bg-sunken" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="h-28 rounded-card bg-sunken" />
        <div className="h-28 rounded-card bg-sunken" />
        <div className="h-28 rounded-card bg-sunken" />
        <div className="h-28 rounded-card bg-sunken" />
      </div>
      <div className="h-48 rounded-card bg-sunken" />
    </div>
  );
}
