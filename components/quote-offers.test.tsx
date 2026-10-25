// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { calculateQuote } from "@/lib/quote";

import { QuoteOffers } from "./quote-offers";

afterEach(cleanup);

/** 40 kW at 75 kWh with $5,000 down: band C, $43,000 financed at 11.9%. */
const { offers } = calculateQuote({
  monthlyConsumptionKwh: 75,
  systemSizeKw: 40,
  downPaymentCents: 500_000,
});

const offerButton = (years: number) =>
  // Anchored, so 5 does not also match "15 years"; the badge may come first.
  screen.getByRole("button", {
    name: new RegExp(`^(Lowest monthly)?${years} years`),
  });

/** Body rows of the schedule table, as cell text. */
function scheduleRows() {
  const table = screen.getByRole("table");

  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) => cell.textContent),
    );
}

describe("QuoteOffers", () => {
  it("shows all three offers, with the 10-year one selected", () => {
    render(<QuoteOffers offers={offers} />);

    expect(offerButton(5).textContent).toContain("$954.34");
    expect(offerButton(10).textContent).toContain("$614.44");
    expect(offerButton(15).textContent).toContain("$513.31");
    expect(offerButton(10).getAttribute("aria-pressed")).toBe("true");
    expect(offerButton(15).textContent).toContain("Lowest monthly");
  });

  it("schedules the selected offer year by year, ending at zero", () => {
    render(<QuoteOffers offers={offers} />);

    expect(
      screen.getByRole("heading", { name: "Amortization schedule · 10 years" }),
    ).toBeTruthy();

    const rows = scheduleRows();

    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual([
      "1",
      "$7,373.28",
      "$2,383.49",
      "$4,989.79",
      "$40,616.51",
    ]);
    expect(rows[9][4]).toBe("$0.00");
  });

  it("switches the schedule when another offer is chosen", async () => {
    const user = userEvent.setup();
    render(<QuoteOffers offers={offers} />);

    await user.click(offerButton(15));

    expect(offerButton(15).getAttribute("aria-pressed")).toBe("true");
    expect(offerButton(10).getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("heading", { name: "Amortization schedule · 15 years" }),
    ).toBeTruthy();
    expect(scheduleRows()).toHaveLength(15);
  });

  it("shows every month on request, and back", async () => {
    const user = userEvent.setup();
    render(<QuoteOffers offers={offers} />);

    await user.click(screen.getByRole("button", { name: "Show every month" }));

    const months = scheduleRows();

    expect(months).toHaveLength(120);
    expect(months[0][1]).toBe("$614.44");
    expect(months[119][4]).toBe("$0.00");

    await user.click(screen.getByRole("button", { name: "Show per year" }));

    expect(scheduleRows()).toHaveLength(10);
  });

  it("tops the chart's axis just above the largest year", () => {
    // 7 kW, no down payment: about $1,271 a year over 10 years.
    const small = calculateQuote({
      monthlyConsumptionKwh: 300,
      systemSizeKw: 7,
      downPaymentCents: 0,
    });

    render(<QuoteOffers offers={small.offers} />);

    const axis = screen.getByRole("img");

    expect(within(axis).getByText("$1.5K")).toBeTruthy();
    expect(within(axis).getByText("$750")).toBeTruthy();
  });
});
