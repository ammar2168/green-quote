"use client";

import { useState } from "react";

import {
  type AmortizationRow,
  amortizationSchedule,
  totalInterestCents,
  yearlySchedule,
} from "@/lib/amortization";
import { formatCents } from "@/lib/money";
import {
  type OfferTermYears,
  type QuoteOffer,
  defaultOffer,
} from "@/lib/quote";

import { AmortizationChart } from "./amortization-chart";
import { DownloadQuotePdfButton } from "./download-quote-pdf-button";

/**
 * The three offers, and the amortization schedule of whichever is selected.
 * The schedules are rebuilt in the browser from the saved offers rather than
 * stored: they follow from the offer exactly, and run to 180 rows.
 */
export function QuoteOffers({
  quoteId,
  offers,
}: {
  quoteId: string;
  offers: QuoteOffer[];
}) {
  const [selectedTerm, setSelectedTerm] = useState<OfferTermYears>(
    defaultOffer(offers).termYears,
  );

  const schedules = offers.map((offer) => ({
    offer,
    months: amortizationSchedule(
      offer.principalUsedCents,
      offer.apr,
      offer.termYears,
      offer.monthlyPaymentCents,
    ),
  }));
  const lowestMonthly = Math.min(
    ...offers.map((offer) => offer.monthlyPaymentCents),
  );
  const selected =
    schedules.find(({ offer }) => offer.termYears === selectedTerm) ??
    schedules[0];

  return (
    <>
      <section aria-labelledby="offers-heading">
        <h2 id="offers-heading" className="text-lg font-semibold">
          Installment offers
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {schedules.map(({ offer, months }) => {
            const isSelected = offer === selected.offer;

            return (
              <button
                key={offer.termYears}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedTerm(offer.termYears)}
                className={`relative rounded-card border bg-surface p-5 text-left shadow-card transition hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:p-6 ${
                  isSelected ? "border-brand ring-1 ring-brand" : "border-line"
                }`}
              >
                {offer.monthlyPaymentCents === lowestMonthly && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-panel px-2.5 py-0.5 text-xs font-semibold text-white">
                    Lowest monthly
                  </span>
                )}
                <span className="block text-muted">
                  {offer.termYears} years
                </span>
                <span className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums">
                  {formatCents(offer.monthlyPaymentCents)}
                  <span className="text-base font-normal text-muted">
                    {" "}
                    /month
                  </span>
                </span>
                <span className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <OfferFigure label="APR" value={`${offer.apr}%`} />
                  <OfferFigure
                    label="Principal"
                    value={formatCents(offer.principalUsedCents, {
                      wholeDollars: true,
                    })}
                  />
                  <OfferFigure
                    label="Interest"
                    value={formatCents(totalInterestCents(months), {
                      wholeDollars: true,
                    })}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Schedule
        quoteId={quoteId}
        offer={selected.offer}
        months={selected.months}
      />
    </>
  );
}

function OfferFigure({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="block text-subtle">{label}</span>
      <span className="block font-medium tabular-nums">{value}</span>
    </span>
  );
}

function Schedule({
  quoteId,
  offer,
  months,
}: {
  quoteId: string;
  offer: QuoteOffer;
  months: AmortizationRow[];
}) {
  const [everyMonth, setEveryMonth] = useState(false);
  const years = yearlySchedule(months);
  const rows = everyMonth ? months : years;

  return (
    <section
      aria-labelledby="schedule-heading"
      className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="schedule-heading" className="text-lg font-semibold">
            Amortization schedule · {offer.termYears} years
          </h2>
          <p className="mt-1 text-sm text-muted">
            {months.length} payments of {formatCents(offer.monthlyPaymentCents)}
            . Early payments are mostly interest; later ones mostly principal.
          </p>
        </div>
        <DownloadQuotePdfButton quoteId={quoteId} termYears={offer.termYears} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <AmortizationChart years={years} />

        <div className="min-w-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {everyMonth ? "Per month" : "Per year"}
            </span>
            <button
              type="button"
              onClick={() => setEveryMonth(!everyMonth)}
              className="font-semibold text-brand hover:text-brand-strong"
            >
              {everyMonth ? "Show per year" : "Show every month"}
            </button>
          </div>

          <div className="mt-3 max-h-[26rem] overflow-auto rounded-control border border-line">
            <table className="w-full text-right text-sm tabular-nums">
              <caption className="sr-only">
                Amortization schedule, {everyMonth ? "per month" : "per year"}
              </caption>
              <thead className="sticky top-0 bg-sunken text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">
                    {everyMonth ? "Month" : "Year"}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Paid
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Principal
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Interest
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.period}>
                    <th
                      scope="row"
                      className="px-3 py-2.5 text-left font-normal"
                    >
                      {row.period}
                    </th>
                    <td className="px-3 py-2.5">
                      {formatCents(row.paidCents)}
                    </td>
                    <td className="px-3 py-2.5">
                      {formatCents(row.principalCents)}
                    </td>
                    <td className="px-3 py-2.5">
                      {formatCents(row.interestCents)}
                    </td>
                    <td className="px-3 py-2.5">
                      {formatCents(row.balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
