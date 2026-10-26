import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "./logo";

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/**
 * `nav` sits beside the logo; `action` fills the right-hand side: a sign-in
 * link, or the account menu.
 */
export function SiteHeader({
  nav,
  action,
}: {
  nav?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur">
      <div className={`${container} flex h-16 items-center gap-2 sm:gap-4`}>
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-ink"
        >
          <LogoMark className="size-7" />
          {/* On a phone the nav needs the room, so the mark stands alone. */}
          <span className={`text-lg ${nav ? "max-sm:sr-only" : ""}`}>
            greenQuote
          </span>
        </Link>
        {nav}
        <div className="ml-auto flex items-center gap-2">{action}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div
        className={`${container} flex flex-wrap items-center justify-between gap-2 py-6 text-xs text-subtle`}
      >
        <p>
          greenQuote is a demo app. Quotes are estimates for illustration, not
          financial offers.
        </p>
        <p>
          Next.js · TypeScript · PostgreSQL · Drizzle ·{" "}
          <Link href="/docs" className="underline hover:text-ink">
            API
          </Link>
        </p>
      </div>
    </footer>
  );
}

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60";
