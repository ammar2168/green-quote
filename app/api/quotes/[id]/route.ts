import { getCurrentUser } from "@/lib/current-user";
import { setLogContext } from "@/lib/logger";
import { deleteQuote } from "@/server/quotes";
import { apiError, jsonRoute } from "@/server/http";

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
