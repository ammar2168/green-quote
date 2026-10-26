import { describe, expect, it } from "vitest";

import { filenameFrom, requestQuotePdf } from "./quote-pdf-download";

const QUOTE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

const GENERIC_FAILURE =
  "We could not create the PDF. Check your connection and try again.";

function respondWith(response: Response | Error): typeof fetch {
  return async () => {
    if (response instanceof Error) throw response;

    return response;
  };
}

function pdfResponse(headers: Record<string, string> = {}): Response {
  return new Response(new Blob(["%PDF-1.7"], { type: "application/pdf" }), {
    headers: {
      "Content-Disposition":
        'attachment; filename="greenquote-quote-c9bf4081-10-years.pdf"',
      ...headers,
    },
  });
}

describe("requestQuotePdf", () => {
  it("asks for the quote's PDF with the chosen term", async () => {
    let seen: string | undefined;

    await requestQuotePdf(QUOTE_ID, 15, async (url) => {
      seen = String(url);
      return pdfResponse();
    });

    expect(seen).toBe(`/api/quotes/${QUOTE_ID}/pdf?term=15`);
  });

  it("is the file and the server's filename on success", async () => {
    const result = await requestQuotePdf(QUOTE_ID, 10, respondWith(pdfResponse()));

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.filename).toBe("greenquote-quote-c9bf4081-10-years.pdf");
    expect(await result.blob.text()).toBe("%PDF-1.7");
  });

  it("falls back to a filename of its own when the header has none", async () => {
    const result = await requestQuotePdf(
      QUOTE_ID,
      5,
      respondWith(pdfResponse({ "Content-Disposition": "attachment" })),
    );

    expect(result.ok && result.filename).toBe("greenquote-quote-5-years.pdf");
  });

  it("asks a signed-out user to sign in again", async () => {
    expect(
      await requestQuotePdf(
        QUOTE_ID,
        10,
        respondWith(Response.json({}, { status: 401 })),
      ),
    ).toEqual({
      ok: false,
      message: "Your session has ended. Sign in again to download this quote.",
    });
  });

  it("says so when the quote has been deleted meanwhile", async () => {
    expect(
      await requestQuotePdf(
        QUOTE_ID,
        10,
        respondWith(Response.json({}, { status: 404 })),
      ),
    ).toEqual({ ok: false, message: "This quote no longer exists." });
  });

  it("passes on the server's message", async () => {
    const result = await requestQuotePdf(
      QUOTE_ID,
      7,
      respondWith(
        Response.json(
          {
            error: {
              code: "invalid_term",
              message: "Choose a term of 5, 10 or 15 years.",
            },
          },
          { status: 400 },
        ),
      ),
    );

    expect(result).toEqual({
      ok: false,
      message: "Choose a term of 5, 10 or 15 years.",
    });
  });

  it("is a generic failure for a non-JSON error page", async () => {
    expect(
      await requestQuotePdf(
        QUOTE_ID,
        10,
        respondWith(new Response("<h1>Bad gateway</h1>", { status: 502 })),
      ),
    ).toEqual({ ok: false, message: GENERIC_FAILURE });
  });

  it("is a generic failure when the network is down", async () => {
    expect(
      await requestQuotePdf(QUOTE_ID, 10, respondWith(new TypeError("offline"))),
    ).toEqual({ ok: false, message: GENERIC_FAILURE });
  });

  it("refuses a 200 that is not a PDF, such as a captive portal's page", async () => {
    expect(
      await requestQuotePdf(
        QUOTE_ID,
        10,
        respondWith(
          new Response("<html></html>", {
            headers: { "Content-Type": "text/html" },
          }),
        ),
      ),
    ).toEqual({ ok: false, message: GENERIC_FAILURE });
  });

  it("refuses an empty PDF", async () => {
    expect(
      await requestQuotePdf(
        QUOTE_ID,
        10,
        respondWith(
          new Response(new Blob([], { type: "application/pdf" })),
        ),
      ),
    ).toEqual({ ok: false, message: GENERIC_FAILURE });
  });
});

describe("filenameFrom", () => {
  it("reads a quoted filename", () => {
    expect(filenameFrom('attachment; filename="quote.pdf"')).toBe("quote.pdf");
  });

  it("is undefined without one", () => {
    expect(filenameFrom("attachment")).toBeUndefined();
    expect(filenameFrom(null)).toBeUndefined();
  });
});
