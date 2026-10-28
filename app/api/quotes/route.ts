import { z } from "zod";

import { getCurrentUser } from "@/lib/current-user";
import { setLogContext } from "@/lib/logger";
import { type QuoteListResponse, toQuoteResponse } from "@/lib/quote-response";
import { quoteRequestSchema } from "@/lib/quote-schema";
import { listAllQuoteResponses } from "@/server/admin";
import { createQuote, listQuoteResponses } from "@/server/quotes";
import {
  PRIVATE_NO_STORE,
  apiError,
  jsonRoute,
  readJson,
  validationError,
} from "@/server/http";

/**
 * Quotes, newest first: the signed-in user's own, or, for an admin, every
 * user's. `?userId=` narrows an admin's list to one user.
 *
 * 200 with `{ quotes }`; 400 for a `userId` that is not a UUID; 401 when
 * signed out; 403 when a non-admin asks for someone else's.
 */
export const GET = jsonRoute(async (request) => {
  const user = await getCurrentUser();

  if (!user) {
    return apiError(401, "unauthorized", "Sign in to see your quotes.");
  }

  const userId = new URL(request.url).searchParams.get("userId") ?? undefined;

  if (userId !== undefined && !z.uuid().safeParse(userId).success) {
    return apiError(400, "invalid_user_id", "userId must be a UUID.");
  }

  // Unlike the admin pages, which answer a non-admin with a 404, the API is
  // documented publicly, so there is nothing to hide by pretending.
  if (user.role !== "admin" && userId !== undefined && userId !== user.id) {
    return apiError(
      403,
      "forbidden",
      "Only an admin can see another user's quotes.",
    );
  }

  if (userId !== undefined) setLogContext({ filterUserId: userId });

  const body: QuoteListResponse = {
    quotes:
      user.role === "admin"
        ? await listAllQuoteResponses({ userId })
        : await listQuoteResponses(user.id),
  };

  return Response.json(body, {
    headers: { "Cache-Control": PRIVATE_NO_STORE },
  });
});

/**
 * Creates a quote for the signed-in user.
 *
 * 201 with the quote and a Location header; 400 with field errors; 401 when
 * signed out; 415 for anything but JSON.
 */
export const POST = jsonRoute(async (request) => {
  // Before the body is read, so a signed-out caller learns nothing about it.
  const user = await getCurrentUser();

  if (!user) {
    return apiError(401, "unauthorized", "Sign in to request a quote.");
  }

  const json = await readJson(request);

  if (!json.ok) return json.response;

  const parsed = quoteRequestSchema.safeParse(json.body);

  if (!parsed.success) return validationError(parsed.error);

  const quote = await createQuote(user.id, parsed.data);

  setLogContext({ quoteId: quote.id });

  return Response.json(toQuoteResponse(quote), {
    status: 201,
    headers: { Location: `/api/quotes/${quote.id}` },
  });
});
