import Link from "next/link";

import { primaryButton } from "./site-chrome";

/** Back to the quote form, for another quote. */
export function NewQuoteLink() {
  return (
    <Link href="/quotes/new" className={primaryButton}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="size-4"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      New quote
    </Link>
  );
}
