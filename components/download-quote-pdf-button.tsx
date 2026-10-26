"use client";

import { useState } from "react";

import { requestQuotePdf } from "@/lib/quote-pdf-download";

import { secondaryButton } from "./site-chrome";

/**
 * How long the saved file's object URL outlives the click. Some browsers read
 * it only after the click handler returns, so revoking at once can cancel the
 * download; a minute is ample and frees the memory soon after.
 */
const REVOKE_OBJECT_URL_AFTER_MS = 60_000;

/**
 * Downloads the quote as a PDF with the schedule of the offer on screen. The
 * file is fetched first and then saved, so the button can say it is working
 * and show why when it fails.
 */
export function DownloadQuotePdfButton({
  quoteId,
  termYears,
}: {
  quoteId: string;
  termYears: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleClick() {
    setPending(true);
    setError(undefined);

    const result = await requestQuotePdf(quoteId, termYears);

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    saveBlob(result.blob, result.filename);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className={secondaryButton}
      >
        <DownloadIcon />
        {pending ? "Preparing PDF…" : "Download PDF"}
        <span className="sr-only">, {termYears}-year schedule</span>
      </button>
      <p
        role="alert"
        className="max-w-64 text-right text-xs text-danger empty:hidden"
      >
        {error}
      </p>
    </div>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_OBJECT_URL_AFTER_MS);
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
