import fontkit from "@pdf-lib/fontkit";
import {
  LineCapStyle,
  PDFDocument,
  type PDFFont,
  type PDFPage,
  type RGB,
  rgb,
} from "pdf-lib";

import type { Quote } from "@/db/schema";

import {
  type AmortizationRow,
  amortizationSchedule,
  totalInterestCents,
  yearlySchedule,
} from "./amortization";
import { formatQuoteDate } from "./format";
import { formatCents } from "./money";
import { BAND_MEANING, type QuoteOffer } from "./quote";

/**
 * A saved quote as a printable A4 PDF: the same figures as the quote page,
 * the offers side by side, and the chosen offer's schedule per year and then
 * per month.
 *
 * Built with pdf-lib, which runs anywhere and needs no browser. The fonts are
 * passed in rather than read here, so this module stays free of I/O: the
 * server reads them from `assets/fonts/` (see `server/quote-pdf.ts`).
 *
 * The fonts are Geist, the app's own typeface, embedded rather than one of
 * the 14 standard PDF fonts: those only encode Windows-1252, so a name such
 * as "Łukasz" or an address in Cyrillic would make pdf-lib throw. Anything
 * Geist itself has no glyph for (CJK, emoji) prints as "?" instead of failing.
 */

export type QuotePdfFonts = {
  regular: Uint8Array;
  semiBold: Uint8Array;
};

type Fonts = { regular: PDFFont; semiBold: PDFFont };

/** A4, in points. */
const PAGE_SIZE: [number, number] = [595.28, 841.89];
const MARGIN_X = 56;
const MARGIN_TOP = 52;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN_X * 2;
/** The footer rule; content stops a little above it. */
const FOOTER_RULE_Y = 60;
const CONTENT_BOTTOM_Y = FOOTER_RULE_Y + 20;

/** The `@theme` tokens in `app/globals.css`. */
const COLOR = {
  ink: hex("#14212e"),
  muted: hex("#56606b"),
  subtle: hex("#7d858e"),
  line: hex("#e6e1d5"),
  lineStrong: hex("#d2ccbd"),
  brand: hex("#c2410c"),
  brandStrong: hex("#9a3412"),
  brandSoft: hex("#fff1e7"),
  sun: hex("#f59e0b"),
  panel: hex("#1f3b57"),
  panelLight: hex("#3d6a93"),
};

const DISCLAIMER =
  "Pre-qualification estimate for illustration, not a credit decision or a financial offer.";

export async function buildQuotePdf(
  quote: Quote,
  offer: QuoteOffer,
  fontBytes: QuotePdfFonts,
  { generatedAt = new Date() }: { generatedAt?: Date } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  pdf.registerFontkit(fontkit);

  const fonts: Fonts = {
    regular: await pdf.embedFont(fontBytes.regular, { subset: true }),
    semiBold: await pdf.embedFont(fontBytes.semiBold, { subset: true }),
  };
  const semiBoldGlyphs = new Set(fonts.semiBold.getCharacterSet());
  const glyphs = new Set(
    fonts.regular.getCharacterSet().filter((code) => semiBoldGlyphs.has(code)),
  );
  const clean = (text: string) =>
    printableText(text, (code) => glyphs.has(code));

  const name = clean(quote.fullName);
  const reference = quoteReference(quote.id);

  // Metadata is stored as UTF-16, so it keeps the name exactly as entered.
  pdf.setTitle(`Solar quote for ${quote.fullName.trim()}`, {
    showInWindowTitleBar: true,
  });
  pdf.setAuthor("greenQuote");
  pdf.setSubject(`Solar pre-qualification quote ${reference}`);
  pdf.setCreator("greenQuote");
  pdf.setProducer("greenQuote");
  pdf.setLanguage("en");
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);

  const layout = new Layout(pdf, fonts, (page, isFirst) => {
    if (!isFirst) drawRunningHeader(page, fonts, `${name} · ${reference}`);
  });

  drawTitleBlock(layout, quote, clean);
  drawBand(layout, quote);
  drawFacts(layout, quote, reference);
  drawOffers(layout, quote.offers, offer);
  drawSchedules(layout, offer);

  drawFooters(pdf, fonts);

  return pdf.save();
}

/** `greenquote-quote-d793187e-10-years.pdf`: ASCII only, safe in any header. */
export function quotePdfFilename(quoteId: string, termYears: number): string {
  return `greenquote-quote-${quoteReference(quoteId)}-${termYears}-years.pdf`;
}

/** The short id printed on the quote, as in the filename. */
export function quoteReference(quoteId: string): string {
  return quoteId.replace(/[^0-9a-z]/gi, "").slice(0, 8).toLowerCase();
}

/**
 * Text as one line the font can draw: runs of whitespace (including the
 * newlines a pasted address brings) become one space, invisible format
 * characters go, and any character without a glyph becomes "?" — a combining
 * mark without one is dropped, since NFC has already folded the ones that
 * have a precomposed form.
 */
export function printableText(
  text: string,
  hasGlyph: (codePoint: number) => boolean,
): string {
  const collapsed = text
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim();

  return Array.from(collapsed, (char) => {
    if (char === " " || hasGlyph(char.codePointAt(0)!)) return char;

    return /\p{M}/u.test(char) ? "" : "?";
  }).join("");
}

/**
 * Breaks text into lines no wider than `maxWidth`, at spaces where it can. A
 * word too long for a line on its own (a 60-character house name, a URL) is
 * broken between characters rather than running off the page.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;

    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);

    line = "";

    for (const char of Array.from(word)) {
      if (line && measure(line + char) > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line += char;
      }
    }
  }

  if (line) lines.push(line);

  return lines;
}

/** Shortens text to fit `maxWidth`, ending in "…" when anything was cut. */
export function truncateText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string {
  if (measure(text) <= maxWidth) return text;

  const chars = Array.from(text);

  while (chars.length > 0 && measure(`${chars.join("")}…`) > maxWidth) {
    chars.pop();
  }

  return `${chars.join("").trimEnd()}…`;
}

// --- Layout --------------------------------------------------------------

/**
 * A cursor that flows content down the page and starts a new page when the
 * next block would run into the footer. `y` is the top of the space left,
 * in PDF points from the bottom of the page.
 */
class Layout {
  page!: PDFPage;
  y = 0;

  constructor(
    private readonly pdf: PDFDocument,
    readonly fonts: Fonts,
    private readonly onNewPage: (page: PDFPage, isFirst: boolean) => void,
  ) {
    this.addPage();
  }

  addPage() {
    const isFirst = this.pdf.getPageCount() === 0;

    this.page = this.pdf.addPage(PAGE_SIZE);
    this.y = PAGE_SIZE[1] - MARGIN_TOP;
    this.onNewPage(this.page, isFirst);

    // The running header on later pages takes the top band.
    if (!isFirst) this.y -= 36;
  }

  /** Starts a new page unless `height` more points fit on this one. */
  ensure(height: number) {
    if (this.y - height < CONTENT_BOTTOM_Y) this.addPage();
  }

  space(height: number) {
    this.y -= height;
  }

  /** Draws one line with its top at the cursor, and moves below it. */
  line(
    text: string,
    {
      size,
      font = this.fonts.regular,
      color = COLOR.ink,
      lineHeight = size * 1.4,
      x = MARGIN_X,
    }: TextStyle & { lineHeight?: number; x?: number },
  ) {
    drawText(this.page, text, { x, top: this.y, size, font, color });
    this.y -= lineHeight;
  }

  /** Wrapped text, each line kept clear of the footer. */
  paragraph(
    text: string,
    style: TextStyle & { lineHeight?: number; width?: number },
  ) {
    const font = style.font ?? this.fonts.regular;
    const lineHeight = style.lineHeight ?? style.size * 1.4;
    const lines = wrapText(text, style.width ?? CONTENT_WIDTH, (part) =>
      font.widthOfTextAtSize(part, style.size),
    );

    for (const text of lines) {
      this.ensure(lineHeight);
      this.line(text, { ...style, font, lineHeight });
    }
  }

  rule(color = COLOR.line) {
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y },
      thickness: 0.75,
      color,
    });
  }
}

type TextStyle = { size: number; font?: PDFFont; color?: RGB };

/** pdf-lib places text by its baseline; this places it by its top. */
function drawText(
  page: PDFPage,
  text: string,
  {
    x,
    top,
    size,
    font,
    color,
    align = "left",
  }: {
    x: number;
    top: number;
    size: number;
    font: PDFFont;
    color: RGB;
    align?: "left" | "right";
  },
) {
  if (!text) return;

  const width = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: align === "right" ? x - width : x,
    y: top - font.heightAtSize(size, { descender: false }),
    size,
    font,
    color,
  });
}

// --- Sections ------------------------------------------------------------

function drawTitleBlock(
  layout: Layout,
  quote: Quote,
  clean: (text: string) => string,
) {
  const { page, fonts } = layout;
  const top = layout.y;

  drawLogo(page, MARGIN_X, top + 2, 26);
  drawText(page, "greenQuote", {
    x: MARGIN_X + 33,
    top: top - 6,
    size: 16,
    font: fonts.semiBold,
    color: COLOR.ink,
  });
  drawText(page, "Solar pre-qualification quote", {
    x: MARGIN_X + CONTENT_WIDTH,
    top: top - 2,
    size: 10,
    font: fonts.regular,
    color: COLOR.muted,
    align: "right",
  });
  drawText(page, formatQuoteDate(quote.createdAt), {
    x: MARGIN_X + CONTENT_WIDTH,
    top: top - 16,
    size: 9,
    font: fonts.regular,
    color: COLOR.subtle,
    align: "right",
  });

  layout.space(44);
  layout.rule();
  layout.space(24);

  layout.paragraph(clean(quote.fullName), {
    size: 20,
    font: fonts.semiBold,
    lineHeight: 25,
  });
  layout.space(3);
  layout.paragraph(clean(quote.address), {
    size: 10,
    color: COLOR.muted,
  });
  layout.paragraph(clean(quote.email), {
    size: 10,
    color: COLOR.muted,
  });
  layout.space(12);
}

function drawBand(layout: Layout, quote: Quote) {
  const { fonts } = layout;
  const padding = 12;
  const meaning = wrapText(
    BAND_MEANING[quote.riskBand],
    CONTENT_WIDTH - padding * 2,
    (text) => fonts.regular.widthOfTextAtSize(text, 9),
  );
  const height = padding * 2 + 18 + meaning.length * 12.5;

  layout.ensure(height);
  layout.page.drawRectangle({
    x: MARGIN_X,
    y: layout.y - height,
    width: CONTENT_WIDTH,
    height,
    color: COLOR.brandSoft,
  });

  layout.space(padding);
  layout.line(`Pre-qualified: risk band ${quote.riskBand}  ·  ${quote.apr}% APR`, {
    x: MARGIN_X + padding,
    size: 13,
    font: fonts.semiBold,
    color: COLOR.brandStrong,
    lineHeight: 18,
  });

  for (const text of meaning) {
    layout.line(text, {
      x: MARGIN_X + padding,
      size: 9,
      color: COLOR.muted,
      lineHeight: 12.5,
    });
  }

  layout.space(padding + 20);
}

function drawFacts(layout: Layout, quote: Quote, reference: string) {
  const { page, fonts } = layout;
  const gutter = 32;
  const columnWidth = (CONTENT_WIDTH - gutter) / 2;
  const columns: [string, string][][] = [
    [
      ["System size", `${formatNumber(quote.systemSizeKw)} kW`],
      [
        "Monthly consumption",
        `${formatNumber(quote.monthlyConsumptionKwh)} kWh`,
      ],
      ["Quote reference", reference],
    ],
    [
      ["System price", formatCents(quote.systemPriceCents)],
      ["Down payment", formatCents(quote.downPaymentCents)],
      ["To finance", formatCents(quote.principalCents)],
    ],
  ];
  const rowHeight = 20;

  layout.ensure(rowHeight * 3);

  columns.forEach((rows, column) => {
    const left = MARGIN_X + column * (columnWidth + gutter);

    rows.forEach(([label, value], row) => {
      const top = layout.y - row * rowHeight;

      drawText(page, label, {
        x: left,
        top,
        size: 10,
        font: fonts.regular,
        color: COLOR.muted,
      });
      drawText(page, value, {
        x: left + columnWidth,
        top,
        size: 10,
        font: fonts.semiBold,
        color: COLOR.ink,
        align: "right",
      });
    });
  });

  layout.space(rowHeight * 3 + 4);
  layout.rule(COLOR.lineStrong);
  layout.space(20);
}

function drawOffers(layout: Layout, offers: QuoteOffer[], selected: QuoteOffer) {
  const lowestMonthly = Math.min(...offers.map((o) => o.monthlyPaymentCents));

  sectionHeading(layout, "Installment offers", 22 + 20 * offers.length);

  drawTable(
    layout,
    [
      { label: "Term", width: 0.24, align: "left" },
      { label: "APR", width: 0.12, align: "right" },
      { label: "Principal", width: 0.2, align: "right" },
      { label: "Monthly payment", width: 0.22, align: "right" },
      { label: "Total interest", width: 0.22, align: "right" },
    ],
    offers.map((offer) => {
      const months = schedule(offer);
      const notes = [
        offer.termYears === selected.termYears && "shown below",
        offer.monthlyPaymentCents === lowestMonthly && "lowest monthly",
      ].filter(Boolean);

      return {
        cells: [
          `${offer.termYears} years`,
          `${offer.apr}%`,
          formatCents(offer.principalUsedCents, { wholeDollars: true }),
          formatCents(offer.monthlyPaymentCents),
          formatCents(totalInterestCents(months), { wholeDollars: true }),
        ],
        note: notes.join(", "),
        highlight: offer.termYears === selected.termYears,
      };
    }),
    { rowHeight: 20, size: 10 },
  );

  layout.space(22);
}

function drawSchedules(layout: Layout, offer: QuoteOffer) {
  const months = schedule(offer);
  const years = yearlySchedule(months);
  const last = months[months.length - 1];
  const interestCents = totalInterestCents(months);
  const lastDiffers = last.paidCents !== offer.monthlyPaymentCents;

  sectionHeading(
    layout,
    `Amortization schedule · ${offer.termYears} years, per year`,
    40 + 16 * 4,
  );
  layout.paragraph(
    `${months.length} monthly payments of ${formatCents(offer.monthlyPaymentCents)}` +
      (lastDiffers
        ? `; the last, ${formatCents(last.paidCents)}, settles the final few cents.`
        : ".") +
      " Early payments are mostly interest; later ones mostly principal.",
    { size: 9, color: COLOR.muted },
  );
  layout.space(6);

  const columns = (period: string): Column[] => [
    { label: period, width: 0.16, align: "left" },
    { label: "Paid", width: 0.21, align: "right" },
    { label: "Principal", width: 0.21, align: "right" },
    { label: "Interest", width: 0.21, align: "right" },
    { label: "Balance", width: 0.21, align: "right" },
  ];
  const cells = (row: AmortizationRow) => [
    String(row.period),
    formatCents(row.paidCents),
    formatCents(row.principalCents),
    formatCents(row.interestCents),
    formatCents(row.balanceCents),
  ];

  drawTable(
    layout,
    columns("Year"),
    [
      ...years.map((row) => ({ cells: cells(row) })),
      {
        cells: [
          "Total",
          // The schedule repays exactly the principal, by construction.
          formatCents(offer.principalUsedCents + interestCents),
          formatCents(offer.principalUsedCents),
          formatCents(interestCents),
          "",
        ],
        total: true,
      },
    ],
    { rowHeight: 16, size: 9 },
  );

  layout.space(26);

  sectionHeading(
    layout,
    `Every payment · ${months.length} months`,
    22 + 14 * 4,
  );
  drawTable(
    layout,
    columns("Month"),
    months.map((row) => ({ cells: cells(row) })),
    { rowHeight: 14, size: 8.5 },
  );
}

function sectionHeading(layout: Layout, text: string, keepWith: number) {
  // Keeps a heading on the same page as the start of what it introduces.
  layout.ensure(24 + keepWith);
  layout.line(text, {
    size: 12,
    font: layout.fonts.semiBold,
    lineHeight: 20,
  });
}

type Column = { label: string; width: number; align: "left" | "right" };
type Row = { cells: string[]; note?: string; highlight?: boolean; total?: boolean };

/**
 * A table whose header repeats at the top of every page it runs onto, so a
 * 180-month schedule still reads column by column on page four.
 */
function drawTable(
  layout: Layout,
  columns: Column[],
  rows: Row[],
  { rowHeight, size }: { rowHeight: number; size: number },
) {
  const { fonts } = layout;
  const headerHeight = 20;
  const edges = columns.reduce<number[]>(
    (xs, column) => [...xs, xs[xs.length - 1] + column.width * CONTENT_WIDTH],
    [MARGIN_X],
  );

  const drawCells = (
    cells: string[],
    style: { size: number; font: PDFFont; color: RGB },
    top: number,
  ) => {
    columns.forEach((column, index) => {
      const pad = index === 0 ? 0 : 6;

      drawText(layout.page, cells[index], {
        ...style,
        top,
        x: column.align === "right" ? edges[index + 1] : edges[index] + pad,
        align: column.align,
      });
    });
  };

  const drawHeader = () => {
    drawCells(
      columns.map((column) => column.label),
      { size: 8.5, font: fonts.regular, color: COLOR.subtle },
      layout.y,
    );
    layout.space(headerHeight - 6);
    layout.rule(COLOR.lineStrong);
    layout.space(6);
  };

  layout.ensure(headerHeight + rowHeight);
  drawHeader();

  for (const row of rows) {
    if (layout.y - rowHeight < CONTENT_BOTTOM_Y) {
      layout.addPage();
      drawHeader();
    }

    if (row.total) layout.rule(COLOR.lineStrong);

    if (row.highlight) {
      layout.page.drawRectangle({
        x: MARGIN_X - 4,
        y: layout.y - rowHeight + 3,
        width: CONTENT_WIDTH + 8,
        height: rowHeight,
        color: COLOR.brandSoft,
      });
    }

    const top = layout.y - (rowHeight - size) / 2 + 1;

    drawCells(
      row.cells,
      {
        size,
        font: row.highlight || row.total ? fonts.semiBold : fonts.regular,
        color: COLOR.ink,
      },
      top,
    );

    if (row.note) {
      const label = row.cells[0];

      drawText(layout.page, row.note, {
        x:
          edges[0] +
          fonts.semiBold.widthOfTextAtSize(label, size) +
          6,
        top: top - 1.5,
        size: 7,
        font: fonts.regular,
        color: row.highlight ? COLOR.brandStrong : COLOR.subtle,
      });
    }

    layout.space(rowHeight);
  }
}

function drawRunningHeader(page: PDFPage, fonts: Fonts, title: string) {
  const top = PAGE_SIZE[1] - MARGIN_TOP + 14;
  const label = "greenQuote";
  const labelWidth = fonts.semiBold.widthOfTextAtSize(label, 10);

  drawLogo(page, MARGIN_X, top + 1, 16);
  drawText(page, label, {
    x: MARGIN_X + 21,
    top: top - 2,
    size: 10,
    font: fonts.semiBold,
    color: COLOR.ink,
  });
  drawText(
    page,
    truncateText(title, CONTENT_WIDTH - labelWidth - 48, (text) =>
      fonts.regular.widthOfTextAtSize(text, 9),
    ),
    {
      x: MARGIN_X + CONTENT_WIDTH,
      top: top - 3,
      size: 9,
      font: fonts.regular,
      color: COLOR.subtle,
      align: "right",
    },
  );
  page.drawLine({
    start: { x: MARGIN_X, y: top - 20 },
    end: { x: MARGIN_X + CONTENT_WIDTH, y: top - 20 },
    thickness: 0.75,
    color: COLOR.line,
  });
}

/** Drawn last, once the page count is known. */
function drawFooters(pdf: PDFDocument, fonts: Fonts) {
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN_X, y: FOOTER_RULE_Y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: FOOTER_RULE_Y },
      thickness: 0.75,
      color: COLOR.line,
    });

    const style = { size: 8, font: fonts.regular, color: COLOR.subtle };

    drawText(page, DISCLAIMER, { ...style, x: MARGIN_X, top: FOOTER_RULE_Y - 10 });
    drawText(page, `Page ${index + 1} of ${pages.length}`, {
      ...style,
      x: MARGIN_X + CONTENT_WIDTH,
      top: FOOTER_RULE_Y - 10,
      align: "right",
    });
  });
}

/** The greenQuote mark from `components/logo.tsx`, `size` points square. */
function drawLogo(page: PDFPage, x: number, top: number, size: number) {
  const scale = size / 32;
  const rays = [
    [16, 2.5, 16, 5],
    [6.5, 6.5, 8.3, 8.3],
    [25.5, 6.5, 23.7, 8.3],
    [3, 13, 5.5, 13],
    [26.5, 13, 29, 13],
  ];

  page.drawCircle({
    x: x + 16 * scale,
    y: top - 13 * scale,
    size: 6 * scale,
    color: COLOR.sun,
  });

  for (const [x1, y1, x2, y2] of rays) {
    page.drawLine({
      start: { x: x + x1 * scale, y: top - y1 * scale },
      end: { x: x + x2 * scale, y: top - y2 * scale },
      thickness: 2 * scale,
      color: COLOR.sun,
      lineCap: LineCapStyle.Round,
    });
  }

  page.drawSvgPath("M4 29l5-10h7l-3 10z", {
    x,
    y: top,
    scale,
    color: COLOR.panel,
  });
  page.drawSvgPath("M13 29l3-10h7l5 10z", {
    x,
    y: top,
    scale,
    color: COLOR.panelLight,
  });
}

// --- Helpers -------------------------------------------------------------

function schedule(offer: QuoteOffer): AmortizationRow[] {
  return amortizationSchedule(
    offer.principalUsedCents,
    offer.apr,
    offer.termYears,
    offer.monthlyPaymentCents,
  );
}

/** `100000` → `"100,000"`, `6.5` → `"6.5"`. */
function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function hex(color: string): RGB {
  const value = Number.parseInt(color.slice(1), 16);

  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
}
