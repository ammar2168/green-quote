import type { Page } from "@playwright/test";

import { formatCents } from "@/lib/money";
import { calculateQuote } from "@/lib/quote";

import { expect, signIn, test } from "./support/fixtures";

/**
 * The core journey: sign in, request a quote, read the results. Expected
 * figures come from the same `calculateQuote` the server runs, so these tests
 * check that the page shows the model's numbers rather than restating them.
 */

const ADDRESS = "1 Solar Way, 94110 San Francisco";
const INPUT = {
  monthlyConsumptionKwh: 450,
  systemSizeKw: 5,
  downPaymentCents: 1000_00,
};
const EXPECTED = calculateQuote(INPUT);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const whole = (cents: number) => formatCents(cents, { wholeDollars: true });

/**
 * By role rather than label: Next.js keeps the sign-in page mounted but
 * hidden after navigating away, and only role queries skip hidden inputs.
 */
const field = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });

test("signs in, requests a quote and shows the saved results", async ({
  page,
  user,
  db,
}) => {
  await signIn(page, user);

  await expect(page).toHaveURL("/quotes/new");

  await test.step("the form is prefilled from the account", async () => {
    await expect(field(page, "Full name")).toHaveValue(user.fullName);
    await expect(field(page, "Email")).toHaveValue(user.email);
  });

  await field(page, "Address").fill(ADDRESS);
  await field(page, "Monthly consumption").fill(
    String(INPUT.monthlyConsumptionKwh),
  );
  await field(page, "System size").fill(String(INPUT.systemSizeKw));
  await field(page, "Down payment (optional)").fill(
    String(INPUT.downPaymentCents / 100),
  );
  await page.getByRole("button", { name: "Get pre-qualification" }).click();

  await expect(page).toHaveURL(new RegExp(`/quotes/${UUID.source}$`));
  const quoteId = page.url().split("/").pop();

  await test.step("the heading names the applicant and address", async () => {
    await expect(
      page.getByRole("heading", { level: 1, name: user.fullName }),
    ).toBeVisible();
    await expect(page.getByText(ADDRESS)).toBeVisible();
  });

  await test.step("the risk band and APR are shown", async () => {
    await expect(
      page.getByRole("heading", {
        name: `Pre-qualified: risk band ${EXPECTED.riskBand}`,
      }),
    ).toContainText(`${EXPECTED.apr}% APR`);
  });

  await test.step("price, down payment and principal are shown", async () => {
    const stat = (label: string) =>
      page.locator("dl > div").filter({
        has: page.getByRole("term").filter({ hasText: label }),
      });

    await expect(stat("System price")).toContainText(
      whole(EXPECTED.systemPriceCents),
    );
    await expect(stat("Down payment")).toContainText(
      whole(INPUT.downPaymentCents),
    );
    await expect(stat("To finance")).toContainText(
      whole(EXPECTED.principalCents),
    );
  });

  const offer = (termYears: number) =>
    page
      .getByRole("region", { name: "Installment offers" })
      // \b keeps "5 years" from also matching "15 years".
      .getByRole("button", {
        name: new RegExp(`\\b${termYears} years`),
      });

  await test.step("each term has its monthly payment", async () => {
    for (const { termYears, monthlyPaymentCents } of EXPECTED.offers) {
      await expect(offer(termYears)).toContainText(
        formatCents(monthlyPaymentCents),
      );
    }
  });

  const schedule = page.getByRole("region", { name: /Amortization schedule/ });
  const yearlyRows = schedule
    .getByRole("table", { name: "Amortization schedule, per year" })
    .locator("tbody tr");

  await test.step("the 10-year offer opens with its schedule", async () => {
    await expect(offer(10)).toHaveAttribute("aria-pressed", "true");
    await expect(schedule.getByRole("heading")).toHaveText(
      "Amortization schedule · 10 years",
    );
    await expect(yearlyRows).toHaveCount(10);
  });

  await test.step("choosing another offer switches the schedule", async () => {
    await offer(15).click();

    await expect(offer(15)).toHaveAttribute("aria-pressed", "true");
    await expect(offer(10)).toHaveAttribute("aria-pressed", "false");
    await expect(schedule.getByRole("heading")).toHaveText(
      "Amortization schedule · 15 years",
    );
    await expect(yearlyRows).toHaveCount(15);
    // The last year pays the balance off exactly.
    await expect(yearlyRows.last().locator("td").last()).toHaveText("$0.00");
  });

  await test.step("the quote is saved to the user's account", async () => {
    const { rows } = await db.query(
      `SELECT system_price_cents, principal_cents, risk_band, offers
       FROM quotes WHERE id = $1 AND user_id = $2`,
      [quoteId, user.id],
    );

    expect(rows).toEqual([
      {
        system_price_cents: EXPECTED.systemPriceCents,
        principal_cents: EXPECTED.principalCents,
        risk_band: EXPECTED.riskBand,
        offers: EXPECTED.offers,
      },
    ]);
  });

  await test.step("My quotes lists it and reopens it", async () => {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "My quotes" })
      .click();

    const rows = page.getByRole("table").locator("tbody tr");

    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(ADDRESS);
    await expect(rows.first()).toContainText(whole(EXPECTED.systemPriceCents));

    await rows.first().getByRole("link", { name: /^View/ }).click();

    await expect(page).toHaveURL(`/quotes/${quoteId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: user.fullName }),
    ).toBeVisible();
  });
});

test("rejects a wrong password and stays signed out", async ({
  page,
  user,
}) => {
  await signIn(page, { email: user.email, password: "not the password" });

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL("/login");

  await page.goto("/quotes/new");

  await expect(page).toHaveURL("/login");
});

test("shows field errors for an invalid quote and saves nothing", async ({
  page,
  user,
  db,
}) => {
  await signIn(page, user);
  await expect(page).toHaveURL("/quotes/new");

  await field(page, "Monthly consumption").fill("lots");
  await field(page, "System size").fill("5");
  await page.getByRole("button", { name: "Get pre-qualification" }).click();

  await expect(field(page, "Address")).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, "Monthly consumption")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page).toHaveURL("/quotes/new");

  const { rows } = await db.query(
    "SELECT count(*)::int AS count FROM quotes WHERE user_id = $1",
    [user.id],
  );

  expect(rows[0].count).toBe(0);
});

test("sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/quotes/new");

  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back" }),
  ).toBeVisible();
});
