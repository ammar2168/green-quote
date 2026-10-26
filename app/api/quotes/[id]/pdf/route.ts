import { getCurrentUser } from "@/lib/current-user";
import { findAnyQuote } from "@/server/admin";
import { apiError, jsonRoute } from "@/server/http";
import { quotePdfResponse, resolvePdfOffer } from "@/server/quote-pdf";
import { findQuote } from "@/server/quotes";

/**
 * A saved quote as a PDF download, with the schedule of the offer named by
 * `?term=` (5, 10 or 15 years; the 10-year one when absent).
 *
 * 200 `application/pdf`; 400 for a term the quote has no offer for; 401 when
 * signed out; 404 when there is no such quote of theirs. An admin may
 * download anyone's quote, as they may view it. Errors answer in the usual
 * JSON shape, which the download button shows inline.
 */
export const GET = jsonRoute<RouteContext<"/api/quotes/[id]/pdf">>(
  async (request, { params }) => {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(401, "unauthorized", "Sign in to download a quote.");
    }

    const { id } = await params;
    const quote =
      user.role === "admin"
        ? await findAnyQuote(id)
        : await findQuote(user.id, id);

    if (!quote) {
      return apiError(404, "not_found", "That quote does not exist.");
    }

    const term = new URL(request.url).searchParams.get("term");
    const offer = resolvePdfOffer(quote.offers, term);

    if (!offer) {
      // The quote's own terms: a snapshot may predate a change to them.
      const terms = new Intl.ListFormat("en-GB", { type: "disjunction" }).format(
        quote.offers.map((offer) => String(offer.termYears)),
      );

      return apiError(
        400,
        "invalid_term",
        `Choose a term of ${terms} years.`,
      );
    }

    return quotePdfResponse(quote, offer);
  },
);
