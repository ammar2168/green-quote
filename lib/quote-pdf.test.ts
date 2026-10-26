import { readFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { Quote } from "@/db/schema";

import { type QuoteInput, calculateQuote } from "./quote";
import {
  buildQuotePdf,
  printableText,
  quotePdfFilename,
  quoteReference,
  truncateText,
  wrapText,
} from "./quote-pdf";

const QUOTE_ID = "d793187e-c228-413f-bad6-24e769f85162";

// The real fonts, so the tests exercise glyph coverage and measuring.
const FONTS = {
  regular: readFileSync("assets/fonts/Geist-Regular.ttf"),
  semiBold: readFileSync("assets/fonts/Geist-SemiBold.ttf"),
};

/** One unit per character: easy to reason about widths. */
const byLength = (text: string) => text.length;

function makeQuote(
  overrides: Partial<Quote> = {},
  input: QuoteInput = {
    monthlyConsumptionKwh: 100,
    systemSizeKw: 10,
    downPaymentCents: 500_000,
  },
): Quote {
  return {
    id: QUOTE_ID,
    userId: "user-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    address: "12 St James's Square, London",
    ...input,
    ...calculateQuote(input),
    createdAt: new Date("2026-10-26T00:36:00Z"),
    updatedAt: new Date("2026-10-26T00:36:00Z"),
    ...overrides,
  };
}

async function render(quote: Quote, termIndex = 1) {
  const bytes = await buildQuotePdf(quote, quote.offers[termIndex], FONTS, {
    generatedAt: new Date("2026-10-26T12:00:00Z"),
  });

  return { bytes, pdf: await PDFDocument.load(bytes) };
}

describe("wrapText", () => {
  it("breaks at spaces, keeping each line within the width", () => {
    expect(wrapText("the quick brown fox", 10, byLength)).toEqual([
      "the quick",
      "brown fox",
    ]);
  });

  it("breaks a word longer than a whole line between characters", () => {
    expect(wrapText("ab abcdefghij", 4, byLength)).toEqual([
      "ab",
      "abcd",
      "efgh",
      "ij",
    ]);
  });

  it("is no lines at all for empty text", () => {
    expect(wrapText("", 10, byLength)).toEqual([]);
  });

  it("keeps an emoji's surrogate pair together", () => {
    expect(wrapText("😀😀😀", 2, byLength)).toEqual(["😀", "😀", "😀"]);
  });
});

describe("truncateText", () => {
  it("leaves text that fits alone", () => {
    expect(truncateText("Ada", 10, byLength)).toBe("Ada");
  });

  it("cuts text that does not, ending in an ellipsis", () => {
    expect(truncateText("Ada Lovelace", 5, byLength)).toBe("Ada…");
  });
});

describe("printableText", () => {
  const latinOnly = (codePoint: number) => codePoint < 0x2000;

  it("collapses newlines and tabs from a pasted address into spaces", () => {
    expect(printableText(" 1 Main St,\n\tSpringfield \r\n", latinOnly)).toBe(
      "1 Main St, Springfield",
    );
  });

  it("drops invisible format characters", () => {
    expect(printableText("Ada​ Love‮lace", latinOnly)).toBe("Ada Lovelace");
  });

  it("replaces a character the font cannot draw with ?", () => {
    expect(printableText("Ada 中 😀", latinOnly)).toBe("Ada ? ?");
  });

  it("composes accents first, so é from e + ◌́ still prints", () => {
    expect(printableText("Renée", latinOnly)).toBe("Renée");
  });
});

describe("quotePdfFilename", () => {
  it("names the file after the quote and the term", () => {
    expect(quotePdfFilename(QUOTE_ID, 10)).toBe(
      "greenquote-quote-d793187e-10-years.pdf",
    );
  });

  it("uses only safe characters, whatever the id", () => {
    expect(quoteReference('a"b\r\n;c/../D')).toBe("abcd");
  });
});

describe("buildQuotePdf", () => {
  it("is a valid PDF titled after the customer", async () => {
    const { bytes, pdf } = await render(makeQuote());

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pdf.getTitle()).toBe("Solar quote for Ada Lovelace");
    expect(pdf.getAuthor()).toBe("greenQuote");
    expect(pdf.getCreationDate()?.toISOString()).toBe(
      "2026-10-26T12:00:00.000Z",
    );
  });

  it("is A4", async () => {
    const { pdf } = await render(makeQuote());

    expect(pdf.getPage(0).getSize()).toEqual({
      width: 595.28,
      height: 841.89,
    });
  });

  it("copes with the longest name and address, in any script", async () => {
    const quote = makeQuote({
      fullName:
        `Łukasz Żółć 中文 😀 ${"Wolfeschlegelsteinhausen".repeat(7)}`.slice(
          0,
          200,
        ),
      address: "Flat 4,\n221B Baker Street, Москва\t".repeat(15).slice(0, 500),
      email: `${"a".repeat(64)}@example.com`,
    });

    const { pdf } = await render(quote, 2);

    // The metadata keeps the name exactly as entered.
    expect(pdf.getTitle()).toBe(`Solar quote for ${quote.fullName}`);
  });

  it("handles the largest system with no down payment", async () => {
    const quote = makeQuote(
      {},
      {
        monthlyConsumptionKwh: 100_000,
        systemSizeKw: 100,
        downPaymentCents: 0,
      },
    );

    await expect(render(quote, 2)).resolves.toBeTruthy();
  });

  it("handles the smallest loan, a single cent", async () => {
    const quote = makeQuote(
      {},
      {
        monthlyConsumptionKwh: 0.01,
        systemSizeKw: 0.01,
        downPaymentCents: 1199,
      },
    );

    expect(quote.principalCents).toBe(1);
    await expect(render(quote, 0)).resolves.toBeTruthy();
  });
});
