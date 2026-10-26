import { openApiDocument } from "@/lib/openapi";

/**
 * The OpenAPI document for the JSON API. Public, like the `/docs` page that
 * renders it: it describes the endpoints, and every one of them still checks
 * the session itself. Built from constants only, so it prerenders.
 */
export function GET(): Response {
  return Response.json(openApiDocument());
}
