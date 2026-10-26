import type { Metadata } from "next";
import Link from "next/link";

import { ApiReference } from "@/components/api-reference";
import {
  SiteFooter,
  SiteHeader,
  primaryButton,
  secondaryButton,
} from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "API reference",
  description: "The greenQuote JSON API, described in OpenAPI 3.1.",
};

const OPENAPI_URL = "/api/openapi.json";

/**
 * Public, like the document it renders. It reads no cookies, so the whole
 * page prerenders; Swagger UI then loads in the browser.
 */
export default function DocsPage() {
  return (
    <>
      <SiteHeader
        action={
          <>
            <Link href="/login" className={secondaryButton}>
              Sign in
            </Link>
            <Link
              href="/quotes/new"
              className={`${primaryButton} max-sm:hidden`}
            >
              Get a quote
            </Link>
          </>
        }
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                API reference
              </h1>
              <p className="mt-2 max-w-2xl text-muted">
                The quote endpoints need a signed-in session. Sign in in this
                browser, and <em>Try it out</em> sends your session cookie for
                you. The health check is public.
              </p>
            </div>
            <a href={OPENAPI_URL} className={secondaryButton} download>
              <DownloadIcon />
              OpenAPI document
            </a>
          </div>

          <div className="mt-8 animate-rise rounded-card border border-line bg-surface p-4 shadow-card sm:p-8">
            <ApiReference url={OPENAPI_URL} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12" />
    </svg>
  );
}
