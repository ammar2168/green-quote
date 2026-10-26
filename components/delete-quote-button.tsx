"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestQuoteDeletion } from "@/lib/quote-delete";

/**
 * Deletes a quote after an inline "are you sure", since a deleted quote cannot
 * be brought back. With `redirectTo` it leaves for that page afterwards (the
 * quote's own page, which would now 404); without, it refreshes the page it is
 * on (the list, which drops the row).
 */
export function DeleteQuoteButton({
  quoteId,
  label,
  redirectTo,
}: {
  quoteId: string;
  /** Names the quote for screen readers, e.g. its date. */
  label: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  // Pending until the page without the quote has rendered, as in QuoteForm.
  const [navigating, startNavigation] = useTransition();
  const pending = deleting || navigating;

  async function handleDelete() {
    setDeleting(true);
    setError(undefined);

    const result = await requestQuoteDeletion(quoteId);

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    startNavigation(() => {
      if (redirectTo) router.replace(redirectTo);
      else router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-semibold whitespace-nowrap text-danger hover:underline"
      >
        Delete<span className="sr-only"> {label}</span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <span role="alert" className="text-xs text-danger empty:hidden">
        {error}
      </span>
      <span className="text-muted whitespace-nowrap">Delete for good?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        // Focus moves here, so a keyboard user lands on the choice they opened.
        autoFocus
        className="rounded-control bg-danger px-2.5 py-1 font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
        <span className="sr-only"> {label}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(undefined);
        }}
        disabled={pending}
        className="font-semibold whitespace-nowrap text-muted hover:text-ink disabled:opacity-60"
      >
        Cancel
      </button>
    </span>
  );
}
