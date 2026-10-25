"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CURRENCY } from "@/lib/money";
import {
  type QuoteFormState,
  submitQuote,
  toQuoteRequestBody,
} from "@/lib/quote-form";

import { Field } from "./field";
import { primaryButton } from "./site-chrome";

/**
 * Posts to `/api/quotes` with `fetch` rather than a Server Action, so the form
 * and any other client share the one JSON API. Inputs stay uncontrolled, and
 * since `onSubmit` (unlike a form `action`) does not reset the form, a failed
 * submit keeps everything that was typed. A saved quote opens on its own page,
 * and the form is cleared behind it: Next.js keeps this page's state for when
 * you come back, so "New quote" would otherwise reopen the last one.
 */
export function QuoteForm({
  defaults,
}: {
  defaults: { fullName: string; email: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<QuoteFormState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  // Pending from the moment the quote is saved until its page has rendered,
  // then idle again by itself — unlike a flag this component would have to
  // remember to clear on a page it has already left.
  const [navigating, startNavigation] = useTransition();
  const pending = submitting || navigating;

  const errors = state.status === "invalid" ? state.errors : {};
  const message =
    state.status === "failed"
      ? state.message
      : state.status === "invalid"
        ? state.message
        : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // React clears `currentTarget` once the handler yields at the `await`.
    const form = event.currentTarget;

    setSubmitting(true);

    const result = await submitQuote(toQuoteRequestBody(new FormData(form)));

    setSubmitting(false);

    if (result.status === "saved") {
      form.reset();
      setState({ status: "idle" });
      startNavigation(() => router.push(`/quotes/${result.quote.id}`));
      return;
    }

    setState(result);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* empty:hidden keeps the live region in the DOM without adding a gap. */}
      <div aria-live="polite" className="empty:hidden">
        {message && (
          <p className="rounded-control border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {message}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Full name"
          name="fullName"
          autoComplete="name"
          defaultValue={defaults.fullName}
          error={errors.fullName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={defaults.email}
          hint="From your account. Change it if you like."
          error={errors.email}
        />
      </div>

      <Field
        label="Address"
        name="address"
        autoComplete="street-address"
        placeholder="Street and number, postal code, city"
        error={errors.address}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Monthly consumption"
          name="monthlyConsumptionKwh"
          inputMode="decimal"
          suffix="kWh"
          hint="On your electricity bill. A family of three uses about 300 kWh."
          error={errors.monthlyConsumptionKwh}
        />
        <Field
          label="System size"
          name="systemSizeKw"
          inputMode="decimal"
          suffix="kW"
          hint="Typical homes: 4–10 kW."
          error={errors.systemSizeKw}
        />
        <Field
          label="Down payment (optional)"
          name="downPayment"
          inputMode="decimal"
          suffix={CURRENCY}
          hint="Leave empty to finance the full price."
          error={errors.downPayment}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Calculating…" : "Get pre-qualification"}
        </button>
        <p className="text-xs text-subtle">
          No credit check. Saved to your account.
        </p>
      </div>
    </form>
  );
}

