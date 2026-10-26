import { describe, expect, it } from "vitest";

import { requestQuoteDeletion } from "./quote-delete";

const QUOTE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

function respondWith(response: Response | Error): typeof fetch {
  return async () => {
    if (response instanceof Error) throw response;

    return response;
  };
}

describe("requestQuoteDeletion", () => {
  it("sends DELETE to the quote's URL", async () => {
    let seen: { url: string; method?: string } | undefined;

    await requestQuoteDeletion(QUOTE_ID, async (url, init) => {
      seen = { url: String(url), method: init?.method };
      return new Response(null, { status: 204 });
    });

    expect(seen).toEqual({ url: `/api/quotes/${QUOTE_ID}`, method: "DELETE" });
  });

  it("is ok on 204", async () => {
    expect(
      await requestQuoteDeletion(
        QUOTE_ID,
        respondWith(new Response(null, { status: 204 })),
      ),
    ).toEqual({ ok: true });
  });

  it("is ok on 404, since the quote is gone either way", async () => {
    expect(
      await requestQuoteDeletion(
        QUOTE_ID,
        respondWith(Response.json({}, { status: 404 })),
      ),
    ).toEqual({ ok: true });
  });

  it("asks a signed-out user to sign in again", async () => {
    const result = await requestQuoteDeletion(
      QUOTE_ID,
      respondWith(Response.json({}, { status: 401 })),
    );

    expect(result).toEqual({
      ok: false,
      message: "Your session has ended. Sign in again to delete this quote.",
    });
  });

  it("passes on the server's message", async () => {
    const result = await requestQuoteDeletion(
      QUOTE_ID,
      respondWith(
        Response.json(
          { error: { code: "internal_error", message: "Try again." } },
          { status: 500 },
        ),
      ),
    );

    expect(result).toEqual({ ok: false, message: "Try again." });
  });

  it("explains a network failure", async () => {
    const result = await requestQuoteDeletion(
      QUOTE_ID,
      respondWith(new TypeError("Failed to fetch")),
    );

    expect(result.ok).toBe(false);
  });
});
