import { getCurrentUser } from "@/lib/current-user";
import { setLogContext } from "@/lib/logger";
import { quoteRequestSchema } from "@/lib/quote-schema";
import { createQuote, toQuoteResponse } from "@/server/quotes";
import { apiError, jsonRoute, readJson, validationError } from "@/server/http";

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
