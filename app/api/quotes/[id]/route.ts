import { getCurrentUser } from "@/lib/current-user";
import { setLogContext } from "@/lib/logger";
import { findAnyQuoteResponse } from "@/server/admin";
import { deleteQuote, findQuoteResponse } from "@/server/quotes";
import { PRIVATE_NO_STORE, apiError, jsonRoute } from "@/server/http";

/**
 * One of the signed-in user's quotes, or, for an admin, anyone's (as with the
 * PDF). Deleting stays owner-only: admin access is read-only.
 *
 * 200 with the quote; 401 when signed out; 404 when there is no such quote of
 * theirs — another user's id answers the same way, so it reveals nothing.
 */
export const GET = jsonRoute<RouteContext<"/api/quotes/[id]">>(
  async (_request, { params }) => {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(401, "unauthorized", "Sign in to see this quote.");
    }

    const { id } = await params;

    setLogContext({ quoteId: id });

    const quote =
      user.role === "admin"
        ? await findAnyQuoteResponse(id)
        : await findQuoteResponse(user.id, id);

    if (!quote) {
      return apiError(404, "not_found", "That quote does not exist.");
    }

    return Response.json(quote, {
      headers: { "Cache-Control": PRIVATE_NO_STORE },
    });
  },
);

/**
 * Deletes one of the signed-in user's quotes.
 *
 * 204 when deleted; 401 when signed out; 404 when there is no such quote of
 * theirs. No body to check, and none needed as a CSRF guard: a form cannot
 * send DELETE, and a cross-site `fetch` with it needs a CORS preflight that
 * this app never answers.
 */
export const DELETE = jsonRoute<RouteContext<"/api/quotes/[id]">>(
  async (_request, { params }) => {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(401, "unauthorized", "Sign in to delete a quote.");
    }

    const { id } = await params;

    setLogContext({ quoteId: id });

    if (!(await deleteQuote(user.id, id))) {
      return apiError(404, "not_found", "That quote does not exist.");
    }

    return new Response(null, { status: 204 });
  },
);
