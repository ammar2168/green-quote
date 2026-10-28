import { formatCents, formatDollars } from "@/lib/money";
import { APR_BY_BAND, BAND_MEANING, PRICE_PER_KW_CENTS } from "@/lib/quote";
import type { QuoteResponse } from "@/lib/quote-response";

import { QuoteOffers } from "./quote-offers";

/**
 * Everything a saved quote says below its heading: the band, the numbers, the
 * offers and how they were worked out, rendered from the shape
 * `GET /api/quotes/{id}` returns. Shared by the user's own quote page and the
 * admin's view of it.
 */
export function QuoteBreakdown({ quote }: { quote: QuoteResponse }) {
  const { inputs, derived } = quote;

  return (
    <>
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
            Pre-qualified: risk band {derived.riskBand}
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
              {derived.apr}% APR
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {BAND_MEANING[derived.riskBand]} Choose one of the three installment
            offers below to see how it is repaid.
          </p>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label="System price"
          value={formatDollars(derived.systemPrice, { wholeDollars: true })}
          note={`${inputs.systemSizeKw} kW × ${formatCents(PRICE_PER_KW_CENTS, { wholeDollars: true })}`}
        />
        <Stat
          label="Down payment"
          value={formatDollars(inputs.downPayment, { wholeDollars: true })}
          note="paid upfront"
        />
        <Stat
          label="To finance"
          value={formatDollars(derived.principal, { wholeDollars: true })}
          note="price − down payment"
        />
        <Stat
          label="Monthly consumption"
          value={`${inputs.monthlyConsumptionKwh} kWh`}
          note={`${inputs.systemSizeKw} kW system`}
        />
      </dl>

      <QuoteOffers quoteId={quote.id} offers={quote.offers} />

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
    </>
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

/** Stands in for a quote heading and breakdown while the quote streams in. */
export function QuoteSkeleton() {
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
