import { z } from "zod";

import { CURRENCY, fromCents, toCents } from "./money";
import {
  APR_BY_BAND,
  PRICE_PER_KW_CENTS,
  calculateQuote,
  offerTermYears,
  riskBands,
} from "./quote";
import {
  MAX_MONTHLY_CONSUMPTION_KWH,
  MAX_SYSTEM_SIZE_KW,
  quoteRequestSchema,
} from "./quote-schema";

/**
 * The OpenAPI 3.1 description of the JSON API, served at `/api/openapi.json`
 * and rendered at `/docs`.
 *
 * The request body is generated from `quoteRequestSchema`, so its types,
 * lengths and ranges cannot drift from what the route enforces. The pricing
 * figures in the prose and the enums read the model's constants, and the
 * examples run through the real `calculateQuote`. What JSON Schema cannot
 * say (the two-decimal rule, the down payment being less than the price) is
 * added here by hand. `lib/openapi.test.ts` checks every route is described.
 */

const SESSION_COOKIE = "session";

const EXAMPLE_ID = "c9bf4081-c228-413f-bad6-24e769f85162";

const EXAMPLE_USER_ID = "5f0e7a52-1b8d-4c1e-9a43-2d6f8b0c7e19";

const exampleRequest = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  address: "12 St James's Square, London",
  monthlyConsumptionKwh: 500,
  systemSizeKw: 5,
  downPayment: 1000,
};

const exampleResult = calculateQuote({
  ...exampleRequest,
  downPaymentCents: toCents(exampleRequest.downPayment),
});

/** What `toQuoteResponse` returns for `exampleRequest`. */
export const exampleQuoteResponse = {
  id: EXAMPLE_ID,
  userId: EXAMPLE_USER_ID,
  createdAt: "2026-10-25T12:00:00.000Z",
  currency: CURRENCY,
  inputs: exampleRequest,
  derived: {
    systemPrice: fromCents(exampleResult.systemPriceCents),
    principal: fromCents(exampleResult.principalCents),
    riskBand: exampleResult.riskBand,
    apr: exampleResult.apr,
  },
  offers: exampleResult.offers.map((offer) => ({
    termYears: offer.termYears,
    apr: offer.apr,
    principalUsed: fromCents(offer.principalUsedCents),
    monthlyPayment: fromCents(offer.monthlyPaymentCents),
  })),
};

const pricePerKw = fromCents(PRICE_PER_KW_CENTS).toLocaleString("en-US");
const terms = offerTermYears.join(", ");
const termChoices = new Intl.ListFormat("en-GB", {
  type: "disjunction",
}).format(offerTermYears.map(String));

/** Dollars, kWh and kW all come as JSON numbers with at most two decimals. */
const TWO_DECIMALS = { multipleOf: 0.01 };

function quoteRequestJsonSchema() {
  // `input`: the body as sent, before `downPayment` becomes cents.
  const generated = z.toJSONSchema(quoteRequestSchema, { io: "input" });

  // OpenAPI 3.1 already speaks this dialect; the marker is noise inside it.
  delete generated.$schema;

  const properties = generated.properties as Record<string, object>;

  return {
    ...generated,
    description:
      "Unknown keys are rejected, so a misspelt `downPayment` is an error " +
      "rather than a quiet $0.",
    properties: {
      fullName: {
        ...properties.fullName,
        description: "Leading and trailing spaces are trimmed.",
      },
      email: { ...properties.email, format: "email" },
      address: {
        ...properties.address,
        description: "The installation address.",
      },
      monthlyConsumptionKwh: {
        ...properties.monthlyConsumptionKwh,
        ...TWO_DECIMALS,
        description: `Average monthly electricity use in kWh, up to ${MAX_MONTHLY_CONSUMPTION_KWH.toLocaleString("en-US")}.`,
      },
      systemSizeKw: {
        ...properties.systemSizeKw,
        ...TWO_DECIMALS,
        description: `System size in kW, up to ${MAX_SYSTEM_SIZE_KW}. Priced at $${pricePerKw} per kW.`,
      },
      downPayment: {
        ...properties.downPayment,
        description:
          "In US dollars, with at most two decimals. Optional: absent or " +
          "null means no down payment. Must be less than the system price.",
      },
    },
    example: exampleRequest,
  };
}

const money = (description: string) => ({
  type: "number",
  ...TWO_DECIMALS,
  description: `${description} In US dollars.`,
});

const apr = {
  type: "number",
  description:
    "Annual percentage rate as a percentage: `6.9` means 6.9%. " +
    `By band: ${riskBands.map((band) => `${band} ${APR_BY_BAND[band]}%`).join(", ")}.`,
};

function errorResponse(description: string, code: string, message: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        example: { error: { code, message } },
      },
    },
  };
}

const unauthorized = (message: string) =>
  errorResponse("Not signed in.", "unauthorized", message);

const notFound = errorResponse(
  "No such quote of yours. Another user's quote id answers the same way, " +
    "so an id reveals nothing about whether it exists.",
  "not_found",
  "That quote does not exist.",
);

/** Quote reads answer with one user's data, so no shared cache may keep them. */
const privateNoStore = {
  "Cache-Control": { schema: { type: "string", const: "private, no-store" } },
};

const internalError = errorResponse(
  "An unexpected failure. Details are logged, never returned.",
  "internal_error",
  "Something went wrong on our side. Please try again.",
);

const quoteIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "The quote's id. Anything that is not a UUID is a 404.",
  schema: { type: "string", format: "uuid" },
  example: EXAMPLE_ID,
};

function healthResponse(description: string, example: object) {
  return {
    description,
    headers: {
      "Cache-Control": { schema: { type: "string", const: "no-store" } },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Health" },
        example,
      },
    },
  };
}

type Operation = { responses: Record<string, { headers?: object }> };

/**
 * `jsonRoute` stamps `x-request-id` on every response, so every response
 * documents it, rather than each one having to remember to.
 */
function withRequestIdHeaders<Paths extends object>(paths: Paths): Paths {
  const operations = Object.values(paths).flatMap(
    (path: Record<string, Operation>) => Object.values(path),
  );

  for (const { responses } of operations) {
    for (const response of Object.values(responses)) {
      response.headers = {
        ...response.headers,
        "x-request-id": { $ref: "#/components/headers/RequestId" },
      };
    }
  }

  return paths;
}

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "greenQuote API",
      version: "1.0.0",
      description: [
        "Solar pre-qualification quotes. Send a home's monthly consumption and a system size, and get back a price, a risk band, an APR and a financing offer for each term.",
        "",
        "**Authentication.** Every quote endpoint needs a signed-in session: the httpOnly `session` cookie set by signing in at `/login`. Sign in in the same browser and *Try it out* sends the cookie for you. The health check is public.",
        "",
        "**Pricing.** " +
          `The price is $${pricePerKw} per kW. ` +
          "The band is A at 400 kWh a month or more on 6 kW or less, otherwise B at 250 kWh or more, otherwise C. " +
          `Offers are ${terms} years at the band's APR, on the price less the down payment.`,
        "",
        "**Request ids.** Every response carries an `x-request-id` header naming its log lines; quote it when reporting a problem. Send your own (up to 128 letters, digits, `_`, `.`, `:` or `-`) and it is reused, so a proxy's logs and ours share one id.",
        "",
        "**Errors.** Every error answers in one shape, `{ error: { code, message, fields? } }`. `code` is a stable snake_case string to branch on; `message` is a sentence fit to show a person; `fields`, on a validation error only, maps each field to its first problem.",
      ].join("\n"),
    },
    tags: [
      {
        name: "Quotes",
        description: "Create, list, read, delete and download quotes.",
      },
      { name: "Health", description: "Whether the app can serve requests." },
    ],
    security: [{ sessionCookie: [] }],
    paths: withRequestIdHeaders({
      "/api/health": {
        get: {
          tags: ["Health"],
          operationId: "checkHealth",
          summary: "Check health",
          description:
            "For load balancers, uptime monitors and container health checks. Runs `select 1` against the database with a short timeout. Public, since a probe has no session, so the body carries no versions, hostnames or error details. Never cached.",
          security: [],
          responses: {
            "200": healthResponse("The app and its database are up.", {
              status: "ok",
              timestamp: "2026-10-26T12:00:00.000Z",
              checks: {
                app: { status: "ok", uptimeSeconds: 3_600 },
                database: { status: "ok", latencyMs: 3 },
              },
            }),
            "503": healthResponse(
              "The database is unreachable. The status code alone is enough to take the instance out of rotation.",
              {
                status: "error",
                timestamp: "2026-10-26T12:00:00.000Z",
                checks: {
                  app: { status: "ok", uptimeSeconds: 3_600 },
                  database: {
                    status: "error",
                    latencyMs: 2_000,
                    message: "The database is unreachable.",
                  },
                },
              },
            ),
            "500": internalError,
          },
        },
      },
      "/api/quotes": {
        get: {
          tags: ["Quotes"],
          operationId: "listQuotes",
          summary: "List quotes",
          description:
            "Newest first. A user gets the quotes they have saved; an admin gets every user's, which `userId` narrows to one user. Wrapped in an object so pagination can be added later without breaking callers.",
          parameters: [
            {
              name: "userId",
              in: "query",
              required: false,
              description:
                "Admins only: list just this user's quotes. A user may pass only their own id.",
              schema: { type: "string", format: "uuid" },
              example: EXAMPLE_USER_ID,
            },
          ],
          responses: {
            "200": {
              description:
                "The user's quotes; an empty list when they have none.",
              headers: privateNoStore,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/QuoteList" },
                  example: { quotes: [exampleQuoteResponse] },
                },
              },
            },
            "400": errorResponse(
              "`userId` is not a UUID.",
              "invalid_user_id",
              "userId must be a UUID.",
            ),
            "401": unauthorized("Sign in to see your quotes."),
            "403": errorResponse(
              "A non-admin asked for another user's quotes.",
              "forbidden",
              "Only an admin can see another user's quotes.",
            ),
            "500": internalError,
          },
        },
        post: {
          tags: ["Quotes"],
          operationId: "createQuote",
          summary: "Create a quote",
          description:
            "Prices the request and saves it to the signed-in user's account. The saved quote is a snapshot: a later pricing change does not alter it.",
          requestBody: {
            required: true,
            description:
              "Must be sent as `application/json` (which also guards against cross-site requests), and be at most 16 KB.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuoteRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "The quote was created.",
              headers: {
                Location: {
                  description: "Where the new quote lives.",
                  schema: { type: "string" },
                  example: `/api/quotes/${EXAMPLE_ID}`,
                },
              },
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Quote" },
                },
              },
            },
            "400": {
              description:
                "The body is not valid JSON, not an object, or has fields that need fixing.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                  examples: {
                    validation_failed: {
                      summary: "Fields need fixing",
                      value: {
                        error: {
                          code: "validation_failed",
                          message: "Some fields need fixing.",
                          fields: {
                            downPayment:
                              "Down payment must be less than the system price of $6,000.00.",
                            downpayment: "Not a recognised field.",
                          },
                        },
                      },
                    },
                    invalid_json: {
                      summary: "Malformed JSON",
                      value: {
                        error: {
                          code: "invalid_json",
                          message: "The request body is not valid JSON.",
                        },
                      },
                    },
                    invalid_body: {
                      summary: "Not an object",
                      value: {
                        error: {
                          code: "invalid_body",
                          message: "The request body must be a JSON object.",
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": unauthorized("Sign in to request a quote."),
            "413": errorResponse(
              "The body is over 16 KB.",
              "body_too_large",
              "The request body is too large.",
            ),
            "415": errorResponse(
              "The body was not sent as `application/json`.",
              "unsupported_media_type",
              "Send the request body as application/json.",
            ),
            "500": internalError,
          },
        },
      },
      "/api/quotes/{id}": {
        get: {
          tags: ["Quotes"],
          operationId: "getQuote",
          summary: "Get a quote",
          description:
            "One of the signed-in user's own quotes, exactly as it was saved. An admin may read anyone's.",
          parameters: [quoteIdParameter],
          responses: {
            "200": {
              description: "The quote.",
              headers: privateNoStore,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Quote" },
                },
              },
            },
            "401": unauthorized("Sign in to see this quote."),
            "404": notFound,
            "500": internalError,
          },
        },
        delete: {
          tags: ["Quotes"],
          operationId: "deleteQuote",
          summary: "Delete a quote",
          description: "Deletes one of the signed-in user's own quotes.",
          parameters: [quoteIdParameter],
          responses: {
            "204": { description: "The quote was deleted." },
            "401": unauthorized("Sign in to delete a quote."),
            "404": notFound,
            "500": internalError,
          },
        },
      },
      "/api/quotes/{id}/pdf": {
        get: {
          tags: ["Quotes"],
          operationId: "downloadQuotePdf",
          summary: "Download a quote as a PDF",
          description:
            "An A4 PDF of the quote with the amortization schedule of one offer. The owner may download their own quotes; an admin may download anyone's.",
          parameters: [
            quoteIdParameter,
            {
              name: "term",
              in: "query",
              required: false,
              description:
                "The offer whose schedule to include, in years. Defaults to 10.",
              schema: { type: "integer", enum: [...offerTermYears] },
            },
          ],
          responses: {
            "200": {
              description:
                "The PDF, as an attachment named after the quote and term. Never cached.",
              headers: {
                "Content-Disposition": {
                  schema: { type: "string" },
                  example: `attachment; filename="greenquote-quote-${EXAMPLE_ID.slice(0, 8)}-10-years.pdf"`,
                },
              },
              content: {
                "application/pdf": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "400": errorResponse(
              "The quote has no offer for that term.",
              "invalid_term",
              `Choose a term of ${termChoices} years.`,
            ),
            "401": unauthorized("Sign in to download a quote."),
            "404": notFound,
            "500": internalError,
          },
        },
      },
    }),
    components: {
      headers: {
        RequestId: {
          description:
            "Names this request's log lines. Echoes a plain incoming `x-request-id`, or is a fresh UUID.",
          schema: { type: "string" },
          example: EXAMPLE_ID,
        },
      },
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: SESSION_COOKIE,
          description:
            "The httpOnly session cookie set by signing in at `/login`. It lasts 7 days.",
        },
      },
      schemas: {
        QuoteRequest: quoteRequestJsonSchema(),
        Quote: {
          type: "object",
          description: "A saved quote. Money is in US dollars.",
          required: [
            "id",
            "userId",
            "createdAt",
            "currency",
            "inputs",
            "derived",
            "offers",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            userId: {
              type: "string",
              format: "uuid",
              description: "The user who saved it.",
            },
            createdAt: { type: "string", format: "date-time" },
            currency: { type: "string", const: CURRENCY },
            inputs: {
              type: "object",
              description: "What was asked, as saved.",
              required: Object.keys(exampleRequest),
              properties: {
                fullName: { type: "string" },
                email: { type: "string", format: "email" },
                address: { type: "string" },
                monthlyConsumptionKwh: { type: "number" },
                systemSizeKw: { type: "number" },
                downPayment: money("0 when none was given."),
              },
            },
            derived: {
              type: "object",
              description: "What the pricing model worked out.",
              required: ["systemPrice", "principal", "riskBand", "apr"],
              properties: {
                systemPrice: money(`$${pricePerKw} per kW.`),
                principal: money("The price less the down payment."),
                riskBand: { type: "string", enum: [...riskBands] },
                apr,
              },
            },
            offers: {
              type: "array",
              description: `One offer per term: ${terms} years.`,
              items: { $ref: "#/components/schemas/Offer" },
            },
          },
          example: exampleQuoteResponse,
        },
        QuoteList: {
          type: "object",
          required: ["quotes"],
          properties: {
            quotes: {
              type: "array",
              description: "Newest first.",
              items: { $ref: "#/components/schemas/Quote" },
            },
          },
        },
        Offer: {
          type: "object",
          required: ["termYears", "apr", "principalUsed", "monthlyPayment"],
          properties: {
            termYears: { type: "integer", enum: [...offerTermYears] },
            apr,
            principalUsed: money("The amount financed."),
            monthlyPayment: money("Rounded to the cent."),
          },
        },
        Health: {
          type: "object",
          required: ["status", "timestamp", "checks"],
          properties: {
            status: {
              type: "string",
              enum: ["ok", "error"],
              description: "`ok` only when every check is.",
            },
            timestamp: { type: "string", format: "date-time" },
            checks: {
              type: "object",
              required: ["app", "database"],
              properties: {
                app: {
                  type: "object",
                  required: ["status", "uptimeSeconds"],
                  properties: {
                    status: { type: "string", const: "ok" },
                    uptimeSeconds: { type: "integer", minimum: 0 },
                  },
                },
                database: {
                  type: "object",
                  required: ["status", "latencyMs"],
                  properties: {
                    status: { type: "string", enum: ["ok", "error"] },
                    latencyMs: {
                      type: "integer",
                      minimum: 0,
                      description:
                        "How long the probe took, or ran before giving up.",
                    },
                    message: {
                      type: "string",
                      description: "On an error only: a generic explanation.",
                    },
                  },
                },
              },
            },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: {
                  type: "string",
                  description: "Stable and snake_case: branch on this.",
                  examples: ["validation_failed", "unauthorized", "not_found"],
                },
                message: {
                  type: "string",
                  description: "A sentence fit to show a person.",
                },
                fields: {
                  type: "object",
                  description:
                    "Validation errors only: each field's first problem.",
                  additionalProperties: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}
