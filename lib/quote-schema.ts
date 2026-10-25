import { z } from "zod";

import { CURRENCY, fromCents, toCents } from "./money";
import { systemPriceCents } from "./quote";

/**
 * The body of `POST /api/quotes`. Kept apart from the route so the quote form
 * can validate with exactly the same rules before it submits.
 *
 * Amounts arrive as JSON numbers in their natural units — kWh, kW and US
 * dollars — and the down payment leaves as integer cents.
 */

/**
 * Sanity caps, not business rules: they catch a typo like 5000 kW for a house,
 * and keep every value well inside its column's precision.
 */
export const MAX_MONTHLY_CONSUMPTION_KWH = 100_000;
export const MAX_SYSTEM_SIZE_KW = 100;

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_ADDRESS_LENGTH = 500;

/**
 * The columns hold two decimals. Anything finer would be rounded by Postgres
 * after it was priced, so the saved size would no longer match its price.
 */
function hasAtMostTwoDecimals(value: number): boolean {
  const hundredths = value * 100;

  return Math.abs(hundredths - Math.round(hundredths)) < 1e-6;
}

const TWO_DECIMALS = "Use at most two decimal places.";

const fullName = z
  .string({ error: "Enter your name." })
  .trim()
  .min(1, "Enter your name.")
  .max(MAX_NAME_LENGTH, `Must be ${MAX_NAME_LENGTH} characters or fewer.`);

const email = z
  .string({ error: "Enter your email." })
  .trim()
  .min(1, "Enter your email.")
  .max(MAX_EMAIL_LENGTH, "Enter a valid email address.")
  .pipe(z.email("Enter a valid email address."));

const address = z
  .string({ error: "Enter the installation address." })
  .trim()
  .min(1, "Enter the installation address.")
  .max(
    MAX_ADDRESS_LENGTH,
    `Must be ${MAX_ADDRESS_LENGTH} characters or fewer.`,
  );

const monthlyConsumptionKwh = z
  .number({ error: "Enter your monthly consumption in kWh, as a number." })
  .positive("Monthly consumption must be more than 0 kWh.")
  .max(
    MAX_MONTHLY_CONSUMPTION_KWH,
    `Monthly consumption must be ${MAX_MONTHLY_CONSUMPTION_KWH.toLocaleString("en-US")} kWh or less.`,
  )
  .refine(hasAtMostTwoDecimals, TWO_DECIMALS);

const systemSizeKw = z
  .number({ error: "Enter the system size in kW, as a number." })
  .positive("System size must be more than 0 kW.")
  .max(
    MAX_SYSTEM_SIZE_KW,
    `System size must be ${MAX_SYSTEM_SIZE_KW} kW or less.`,
  )
  .refine(hasAtMostTwoDecimals, TWO_DECIMALS);

/** Optional: absent or null both mean no down payment. */
const downPayment = z
  .number({ error: "Enter the down payment in US dollars, as a number." })
  .nonnegative("Down payment cannot be negative.")
  .refine(hasAtMostTwoDecimals, "Use whole cents: at most two decimal places.")
  .nullish();

/** The two fields the cross-field check below reads. */
const pricedFields = z.object({ systemSizeKw, downPayment });

export const quoteRequestSchema = z
  // Strict, because an unknown key is almost always a misspelt one, and a
  // misspelt `downPayment` would otherwise quietly become a $0 down payment.
  .strictObject(
    {
      fullName,
      email,
      address,
      monthlyConsumptionKwh,
      systemSizeKw,
      downPayment,
    },
    {
      error: (issue) =>
        issue.code === "invalid_type"
          ? "The request body must be a JSON object."
          : undefined,
    },
  )
  // A down payment at or above the price leaves nothing to finance, so every
  // offer would be $0 a month. That is a mistake on the form, not a quote.
  .refine(
    (input) =>
      toCents(input.downPayment ?? 0) < systemPriceCents(input.systemSizeKw),
    {
      path: ["downPayment"],
      error: (issue) => {
        const input = issue.input as z.input<typeof pricedFields>;
        const price = fromCents(systemPriceCents(input.systemSizeKw));

        return `Down payment must be less than the system price of ${formatUsd(price)}.`;
      },
      // Runs even when other fields failed, so the form shows every error at
      // once — but only when the two fields it reads are themselves valid.
      when: (payload) => pricedFields.safeParse(payload.value).success,
    },
  )
  .transform(({ downPayment, ...rest }) => ({
    ...rest,
    downPaymentCents: toCents(downPayment ?? 0),
  }));

export type QuoteRequestBody = z.input<typeof quoteRequestSchema>;
export type QuoteRequest = z.output<typeof quoteRequestSchema>;

function formatUsd(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: CURRENCY,
  });
}
