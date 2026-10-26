import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Quote } from "@/db/schema";
import { defaultOffer, type QuoteOffer } from "@/lib/quote";
import {
  type QuotePdfFonts,
  buildQuotePdf,
  quotePdfFilename,
} from "@/lib/quote-pdf";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

let fonts: Promise<QuotePdfFonts> | undefined;

/**
 * Read once per server process: about 250 KB that never changes. A failed
 * read is not cached, so a transient error does not break every later PDF.
 */
export function loadQuotePdfFonts(): Promise<QuotePdfFonts> {
  fonts ??= Promise.all([
    readFile(path.join(FONT_DIR, "Geist-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Geist-SemiBold.ttf")),
  ]).then(
    ([regular, semiBold]) => ({ regular, semiBold }),
    (error: unknown) => {
      fonts = undefined;
      throw error;
    },
  );

  return fonts;
}

/**
 * The offer a `?term=` asks for. No term means the one the quote page opens
 * on. A term the quote has no offer for is undefined; that includes junk
 * such as `10.0` or `1e1`, which only a hand-edited URL would send.
 */
export function resolvePdfOffer(
  offers: QuoteOffer[],
  term: string | null,
): QuoteOffer | undefined {
  if (term === null) return defaultOffer(offers);
  if (!/^\d{1,3}$/.test(term)) return undefined;

  return offers.find((offer) => offer.termYears === Number(term));
}

/**
 * The PDF as a download. `no-store`, because it carries the customer's name
 * and address and must not linger in a shared cache.
 */
export async function quotePdfResponse(
  quote: Quote,
  offer: QuoteOffer,
): Promise<Response> {
  const bytes = await buildQuotePdf(quote, offer, await loadQuotePdfFonts());
  const filename = quotePdfFilename(quote.id, offer.termYears);

  return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
