// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { calculateQuote } from "@/lib/quote";

import { QuoteOffers } from "./quote-offers";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const QUOTE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

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
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

    expect(offerButton(5).textContent).toContain("$954.34");
    expect(offerButton(10).textContent).toContain("$614.44");
    expect(offerButton(15).textContent).toContain("$513.31");
    expect(offerButton(10).getAttribute("aria-pressed")).toBe("true");
    expect(offerButton(15).textContent).toContain("Lowest monthly");
  });

  it("schedules the selected offer year by year, ending at zero", () => {
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

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
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

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
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

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

    render(<QuoteOffers quoteId={QUOTE_ID} offers={small.offers} />);

    const axis = screen.getByRole("img");

    expect(within(axis).getByText("$1.5K")).toBeTruthy();
    expect(within(axis).getByText("$750")).toBeTruthy();
  });
});

describe("QuoteOffers' PDF download", () => {
  const downloadButton = () =>
    screen.getByRole("button", { name: /^Download PDF|^Preparing PDF/ });

  /** Stubs fetch with `respond`, and records every file the page saves. */
  function stubDownload(respond: () => Promise<Response>) {
    const requested: string[] = [];
    const saved: { href: string; download: string }[] = [];

    vi.stubGlobal("fetch", async (url: string) => {
      requested.push(url);
      return respond();
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:quote",
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ href: this.href, download: this.download });
    });

    return { requested, saved };
  }

  // A string body: Node's Response does not read jsdom's Blob.
  const pdf = () =>
    new Response("%PDF-1.7", {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="quote-15-years.pdf"',
      },
    });

  it("downloads the PDF of the offer on screen", async () => {
    const user = userEvent.setup();
    const { requested, saved } = stubDownload(async () => pdf());
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

    await user.click(offerButton(15));
    await user.click(downloadButton());

    expect(requested).toEqual([`/api/quotes/${QUOTE_ID}/pdf?term=15`]);
    expect(saved).toEqual([
      { href: "blob:quote", download: "quote-15-years.pdf" },
    ]);
    expect(downloadButton().hasAttribute("disabled")).toBe(false);
  });

  it("is disabled while the PDF is prepared, so a double click fetches once", async () => {
    const user = userEvent.setup();
    let finish: (response: Response) => void = () => {};
    const { requested } = stubDownload(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

    await user.dblClick(downloadButton());

    expect(downloadButton().textContent).toContain("Preparing PDF…");
    expect(downloadButton().hasAttribute("disabled")).toBe(true);
    expect(requested).toHaveLength(1);

    finish(pdf());

    expect(await screen.findByText("Download PDF")).toBeTruthy();
  });

  it("shows why a download failed, and clears it on retry", async () => {
    const user = userEvent.setup();
    let status = 401;
    stubDownload(async () =>
      status === 401 ? Response.json({}, { status }) : pdf(),
    );
    render(<QuoteOffers quoteId={QUOTE_ID} offers={offers} />);

    await user.click(downloadButton());

    expect(screen.getByRole("alert").textContent).toBe(
      "Your session has ended. Sign in again to download this quote.",
    );

    status = 200;
    await user.click(downloadButton());

    expect(screen.getByRole("alert").textContent).toBe("");
  });
});
