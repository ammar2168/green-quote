import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { HeroArt } from "@/components/hero-art";
import {
  SiteFooter,
  SiteHeader,
  primaryButton,
  secondaryButton,
} from "@/components/site-chrome";
import { USER_HOME_PATH } from "@/lib/home-path";
import { formatCents } from "@/lib/money";
import {
  APR_BY_BAND,
  PRICE_PER_KW_CENTS,
  calculateQuote,
  offerTermYears,
  riskBands,
  type RiskBand,
} from "@/lib/quote";
import { readSession } from "@/lib/session";

// The hero's sample quote runs through the real pricing model, so the numbers
// on the landing page can never drift from what the app actually quotes.
const SAMPLE_KW = 5.5;
const SAMPLE_KWH = 450;
const sample = calculateQuote({
  monthlyConsumptionKwh: SAMPLE_KWH,
  systemSizeKw: SAMPLE_KW,
  downPaymentCents: 0,
});
const sampleLongest = sample.offers[sample.offers.length - 1];

const aprRange = `${APR_BY_BAND.A}%–${APR_BY_BAND.C}%`;

const steps = [
  {
    title: "Tell us about your home",
    body: "Your address, how much electricity you use and the system size you have in mind.",
    icon: <HomeIcon />,
  },
  {
    title: "Get pre-qualified instantly",
    body: `See the system price, your risk band and three installment offers over ${offerTermYears.join(", ").replace(/, (\d+)$/, " and $1")} years.`,
    icon: <BoltIcon />,
  },
  {
    title: "Keep your quote",
    body: "Every quote is saved to your account, with its full repayment schedule and a PDF to download.",
    icon: <DocIcon />,
  },
];

const bandCopy: Record<RiskBand, string> = {
  A: "400+ kWh a month on a system of 6 kW or less. Your savings comfortably cover the payment.",
  B: "250+ kWh a month. A solid fit for most family homes.",
  C: "Lighter usage or a larger system. Still financeable, at a higher rate.",
};

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export default function Home() {
  return (
    <>
      <SiteHeader
        nav={
          <nav aria-label="Page" className="hidden gap-1 text-sm sm:flex">
            <a
              href="#how-it-works"
              className="rounded-control px-3 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              How it works
            </a>
            <a
              href="#rates"
              className="rounded-control px-3 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Rates
            </a>
          </nav>
        }
        action={
          <ForViewer
            signedOut={
              <>
                <Link href="/login" className={secondaryButton}>
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className={`${primaryButton} max-sm:hidden`}
                >
                  Create account
                </Link>
              </>
            }
            signedIn={
              <Link href="/quotes" className={primaryButton}>
                Go to my quotes
              </Link>
            }
          />
        }
      />

      <main className="flex-1">
        <section
          className={`${container} grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20`}
        >
          <div className="animate-rise">
            <p className="inline-flex rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-medium text-brand-strong">
              Residential solar · pre-qualification
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
              See what solar would cost you, before anyone visits your roof.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-muted">
              Answer a few questions and get a pre-qualification quote in
              seconds: system price, risk band and monthly payments for three
              loan terms.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <GetQuoteLink />
              <a
                href="#how-it-works"
                className={`${secondaryButton} px-5 py-3`}
              >
                How it works
              </a>
            </div>
            <p className="mt-4 text-sm text-subtle">
              No credit check. Takes about a minute.
            </p>
          </div>

          <div className="relative animate-rise lg:[animation-delay:120ms]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-panel shadow-lift lg:rounded-[2rem]">
              <HeroArt className="absolute inset-0 h-full w-full animate-ken-burns" />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-ink/40 via-transparent to-transparent"
              />
              <ul className="absolute top-4 left-4 flex flex-wrap gap-2 text-xs font-medium text-white">
                <Chip>
                  {SAMPLE_KW} kW ·{" "}
                  {formatCents(sample.systemPriceCents, { wholeDollars: true })}
                </Chip>
                <Chip>
                  Band {sample.riskBand} · {sample.apr}% APR
                </Chip>
              </ul>
            </div>

            <div className="absolute -bottom-6 left-4 rounded-card border border-line bg-surface px-5 py-4 shadow-lift lg:-left-6">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-full bg-emerald-500" />
                Pre-qualified · {sampleLongest.termYears} years
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatCents(sampleLongest.monthlyPaymentCents)}
                <span className="text-sm font-normal text-muted">/month</span>
              </p>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className={`${container} scroll-mt-20 pt-12 sm:pt-16`}
        >
          <SectionHeading
            eyebrow="How it works"
            title="Three steps, about a minute."
          />
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-card border border-line bg-surface p-6 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-control bg-brand-soft text-brand">
                    {step.icon}
                  </span>
                  <span className="text-xs font-medium tracking-wider text-subtle uppercase">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="rates"
          className={`${container} scroll-mt-20 pt-16 sm:pt-24`}
        >
          <SectionHeading
            eyebrow="Transparent pricing"
            title="Your usage sets your band. Your band sets your rate."
            body={`Every system is priced at ${formatCents(PRICE_PER_KW_CENTS, { wholeDollars: true })} per kW installed. No hidden fees, no sales call to find out.`}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {riskBands.map((band) => (
              <div
                key={band}
                className={`rounded-card border bg-surface p-6 shadow-card ${
                  band === "A" ? "border-brand/40" : "border-line"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-muted">
                    Band {band}
                  </span>
                  {band === "A" && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-strong">
                      Best rate
                    </span>
                  )}
                </div>
                <p className="mt-3 text-4xl font-semibold tracking-tight">
                  {APR_BY_BAND[band]}%
                  <span className="ml-1 text-base font-normal text-muted">
                    APR
                  </span>
                </p>
                <p className="mt-3 text-sm text-muted">{bandCopy[band]}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-6 py-4">
              <p className="font-semibold">
                Example: {SAMPLE_KW} kW system, {SAMPLE_KWH} kWh a month
              </p>
              <p className="text-sm text-muted">
                {formatCents(sample.systemPriceCents, { wholeDollars: true })} ·
                Band {sample.riskBand} · no down payment
              </p>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-line">
              {sample.offers.map((offer) => (
                <div key={offer.termYears} className="px-4 py-5 sm:px-6">
                  <dt className="text-sm text-muted">
                    {offer.termYears} years
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                    {formatCents(offer.monthlyPaymentCents, {
                      wholeDollars: true,
                    })}
                    <span className="text-sm font-normal text-muted">/mo</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={`${container} pt-16 sm:pt-24`}>
          <div className="relative overflow-hidden rounded-[1.5rem] bg-panel px-6 py-12 text-white shadow-lift sm:px-12 sm:py-16 lg:rounded-[2rem]">
            <HeroArt className="absolute inset-0 h-full w-full opacity-60" />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-r from-ink/90 via-ink/70 to-ink/20"
            />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                One quote, three ways to pay.
              </h2>
              <p className="mt-4 text-white/80">
                Your usage and system size set the risk band; the band sets the
                rate. Then you see fixed monthly payments over{" "}
                {offerTermYears.join(", ").replace(/, (\d+)$/, " or $1")} years,
                with the full repayment schedule.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2 text-sm">
                <Chip>
                  {formatCents(PRICE_PER_KW_CENTS, { wholeDollars: true })} per
                  kW installed
                </Chip>
                <Chip>{aprRange} APR by band</Chip>
                <Chip>{offerTermYears.join(" · ")} year terms</Chip>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <GetQuoteLink />
                <ForViewer
                  signedOut={
                    <Link
                      href="/signup"
                      className="inline-flex items-center justify-center rounded-control border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Create a free account
                    </Link>
                  }
                  signedIn={null}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * Renders `signedOut` or `signedIn` depending on the session cookie, so a
 * signed-in visitor is not offered "Sign in" as if the session were lost.
 *
 * It checks the cookie's signature only, without the database round trip
 * `getCurrentUser` makes, so the swap lands right after the static shell.
 * That is enough to pick links: every page they lead to still runs
 * `requireUser`. Until the cookie has been read, the signed-out version holds
 * its space invisibly rather than flashing the wrong buttons.
 */
function ForViewer({
  signedOut,
  signedIn,
}: {
  signedOut: ReactNode;
  signedIn: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <span aria-hidden="true" className="invisible contents">
          {signedOut}
        </span>
      }
    >
      <ViewerSwitch signedOut={signedOut} signedIn={signedIn} />
    </Suspense>
  );
}

async function ViewerSwitch({
  signedOut,
  signedIn,
}: {
  signedOut: ReactNode;
  signedIn: ReactNode;
}) {
  return (await readSession()) ? signedIn : signedOut;
}

/**
 * Always the quote form: `requireUser` there sends a signed-out visitor to
 * sign in, so the link needs no session check and never waits on one.
 */
function GetQuoteLink() {
  return (
    <Link href={USER_HOME_PATH} className={`${primaryButton} px-5 py-3`}>
      Get my quote
      <ArrowIcon />
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
      {body && <p className="mt-3 text-muted">{body}</p>}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="rounded-full border border-white/25 bg-ink/40 px-3 py-1 backdrop-blur">
      {children}
    </li>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

function BoltIcon() {
  return (
    <Icon>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </Icon>
  );
}

function DocIcon() {
  return (
    <Icon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </Icon>
  );
}

function ArrowIcon() {
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
