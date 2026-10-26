import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { calculateQuote } from "@/lib/quote";
import { quoteRequestSchema } from "@/lib/quote-schema";
import { toQuoteResponse } from "@/server/quotes";

import { exampleQuoteResponse, openApiDocument } from "./openapi";

// `toQuoteResponse` lives beside the queries; it never touches the database.
vi.mock("@/db", () => ({ db: {} }));

const API_DIR = join(import.meta.dirname, "..", "app", "api");

/** The document describes the API, not itself. */
const UNDOCUMENTED = ["/api/openapi.json"];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** `app/api/quotes/[id]/route.ts` → `/api/quotes/{id}`, with its methods. */
function routeHandlers(): Record<string, string[]> {
  const routes: Record<string, string[]> = {};

  for (const file of readdirSync(API_DIR, { recursive: true })) {
    const path = String(file);

    if (!path.endsWith(`${sep}route.ts`)) continue;

    const route = `/api/${dirname(path).split(sep).join("/")}`.replace(
      /\[(\w+)\]/g,
      "{$1}",
    );
    const source = readFileSync(join(API_DIR, path), "utf8");

    routes[route] = HTTP_METHODS.filter((method) =>
      new RegExp(`export (const|(async )?function) ${method}\\b`).test(source),
    );
  }

  return routes;
}

describe("openApiDocument", () => {
  const document = openApiDocument();

  it("describes every route handler and method, and nothing else", () => {
    const handlers = Object.fromEntries(
      Object.entries(routeHandlers()).filter(
        ([route]) => !UNDOCUMENTED.includes(route),
      ),
    );
    const documented = Object.fromEntries(
      Object.entries(document.paths).map(([route, operations]) => [
        route,
        Object.keys(operations).map((method) => method.toUpperCase()),
      ]),
    );

    expect(documented).toEqual(handlers);
  });

  it("gives every operation a unique id, a summary and a 500", () => {
    const operations = Object.values(document.paths).flatMap((path) =>
      Object.values(path),
    );
    const ids = operations.map((operation) => operation.operationId);

    expect(new Set(ids).size).toBe(operations.length);

    for (const operation of operations) {
      expect(operation.summary).toBeTruthy();
      expect(operation.responses).toHaveProperty("500");
    }
  });

  it("names the request id header on every response", () => {
    const responses = Object.values(document.paths).flatMap((path) =>
      Object.values(path).flatMap((operation): { headers?: object }[] =>
        Object.values(operation.responses),
      ),
    );

    for (const response of responses) {
      expect(response.headers).toHaveProperty("x-request-id");
    }
  });

  it("leaves only the health check open to callers without a session", () => {
    const publicOperations = Object.values(document.paths)
      .flatMap((path) => Object.values(path))
      .filter((operation) => "security" in operation)
      .map((operation) => operation.operationId);

    expect(publicOperations).toEqual(["checkHealth"]);
    expect(document.paths["/api/health"].get.security).toEqual([]);
  });

  it("resolves every $ref to a component it defines", () => {
    const refs = JSON.stringify(document).match(/"#\/components\/\w+\/\w+"/g);

    for (const ref of refs ?? []) {
      const [, , kind, name] = JSON.parse(ref).split("/");

      expect(document.components).toHaveProperty([kind, name]);
    }
  });

  it("generates the request body from the route's own schema", () => {
    const schema = document.components.schemas.QuoteRequest;

    expect(schema.required).toEqual([
      "fullName",
      "email",
      "address",
      "monthlyConsumptionKwh",
      "systemSizeKw",
    ]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.systemSizeKw).toMatchObject({
      type: "number",
      exclusiveMinimum: 0,
      maximum: 100,
    });
  });

  it("has a request example the route accepts", () => {
    const example = document.components.schemas.QuoteRequest.example;

    expect(quoteRequestSchema.safeParse(example).success).toBe(true);
  });

  it("has a response example exactly as the route would answer it", () => {
    const request = quoteRequestSchema.parse(exampleQuoteResponse.inputs);

    expect(
      toQuoteResponse({
        id: exampleQuoteResponse.id,
        userId: "user-1",
        ...request,
        ...calculateQuote(request),
        createdAt: new Date(exampleQuoteResponse.createdAt),
        updatedAt: new Date(exampleQuoteResponse.createdAt),
      }),
    ).toEqual(exampleQuoteResponse);
  });

  it("serialises to JSON without losing anything", () => {
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });
});
