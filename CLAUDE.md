@AGENTS.md

# greenQuote

Solar pre-qualification quotes. A signed-in user enters address, monthly kWh and system size (plus an optional down payment) and gets a system price, a risk band, an APR and three installment offers (5/10/15 years) with an amortization schedule. Every quote is saved to their account. An admin can browse all users and view any user's quotes.

Stack: Next.js 16 App Router (`cacheComponents`, Turbopack), React 19, TypeScript strict, Tailwind v4, PostgreSQL 18 through Drizzle ORM (`node-postgres`), Zod 4, `jose` JWT sessions, Vitest 5. Package manager is **pnpm**. Import alias `@/*` maps to the repo root.

## Local setup and verification

```bash
cp .env.example .env          # then set SESSION_SECRET (openssl rand -base64 32)
docker compose up -d          # Postgres; compose project name is pinned, so all worktrees share one DB
pnpm db:migrate
pnpm db:seed:admin '<password>'   # admin@greenquote; re-running resets the password
pnpm dev                      # .claude/launch.json runs it on port 3100
```

Before calling work done, run all three and keep them green:

- `pnpm test --run`: Vitest (bare `pnpm test` starts watch mode).
- `pnpm typecheck`: the global `PageProps`, `LayoutProps` and `RouteContext` types are generated into `.next/`. In a fresh checkout or worktree, run `pnpm exec next typegen` first (or `pnpm dev` once).
- `pnpm lint`
- `pnpm format:check` (`pnpm format` rewrites). Prettier owns formatting; `eslint-config-prettier` turns off the ESLint rules that would fight it.

Importing `db/index.ts` or `lib/session.ts` throws at module load when `DATABASE_URL` / `SESSION_SECRET` is unset. Scripts outside Next (`scripts/`, `drizzle.config.ts`) load `.env` themselves through `@next/env`, and a new script imports `./load-env` first for the same reason.

## Layout and layering

Code flows one way: `app/` (routes) → `components/` (UI) and `server/` (DB reads/writes) → `lib/` (pure logic and helpers) → `db/` (schema).

| Path            | Holds                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`          | Routes. `(auth)/` route group for `/login` and `/signup` with a shared layout. `actions/auth.ts` holds the signup/login/logout Server Actions. `api/quotes/` is the JSON API. `admin/` contains the admin pages. `dashboard/` is a leftover placeholder that nothing links to. |
| `components/`   | One component (or a small family) per kebab-case file, named exports, no barrel files.                                                                                                                                                                                         |
| `server/`       | Data access per domain (`quotes.ts`, `admin.ts`) plus `http.ts` for the shared JSON route plumbing. Only Server Components and route handlers import from here.                                                                                                                |
| `lib/`          | Pure, React-free modules shared by server and browser (`quote.ts`, `money.ts`, `amortization.ts`, `quote-schema.ts`), plus server-only helpers (`session.ts`, `current-user.ts`, `password.ts`).                                                                               |
| `db/`           | `schema.ts` (the single source of truth for tables), `index.ts` (pool + `db`), `migrations/` (drizzle-kit output). `db/init/` is mounted as Postgres's init-script directory.                                                                                                  |
| `scripts/`      | `tsx` CLI scripts (`seed-admin.ts`).                                                                                                                                                                                                                                           |
| `assets/fonts/` | Geist TTFs (OFL) embedded in the quote PDF, read by `server/quote-pdf.ts`. The standard PDF fonts only encode Windows-1252, so a name like "Łukasz" would make them throw.                                                                                                     |

Tests sit next to the file they test as `*.test.ts(x)`.

### Routes

| Route                                          | Access         | Notes                                                                                                                                                                                 |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                            | public         | Landing page. Its sample numbers come from the real `calculateQuote`.                                                                                                                 |
| `/login`, `/signup`                            | public         | `useActionState` forms backed by `app/actions/auth.ts`. Users land on `/quotes/new`, admins on `/admin/users`.                                                                        |
| `/quotes/new`                                  | user           | `QuoteForm`, prefilled with the user's name and email.                                                                                                                                |
| `/quotes`                                      | user           | The user's quotes, with delete.                                                                                                                                                       |
| `/quotes/[id]`                                 | user (owner)   | `QuoteBreakdown` plus delete.                                                                                                                                                         |
| `/admin`                                       | admin          | Redirects to `/admin/users`.                                                                                                                                                          |
| `/admin/users`                                 | admin          | Name/email filters through a GET `next/form` (`?name=&email=`).                                                                                                                       |
| `/admin/users/[id]` and `.../quotes/[quoteId]` | admin          | Read-only views reusing `QuotesTable` / `QuoteBreakdown`.                                                                                                                             |
| `GET /api/health`                              | public         | App and database status (`server/health.ts` runs `select 1` with a 2 s timeout). 200 when healthy, 503 when the database is unreachable; `no-store`, no internal details in the body. |
| `POST /api/quotes`                             | user           | 201 + `Location`; 400 / 401 / 413 / 415.                                                                                                                                              |
| `DELETE /api/quotes/[id]`                      | user (owner)   | 204; 401; 404.                                                                                                                                                                        |
| `GET /api/quotes/[id]/pdf?term=`               | owner or admin | The quote as an A4 PDF (`lib/quote-pdf.ts`) with the chosen offer's schedule; no term means the 10-year one. 200 attachment; 400 `invalid_term`; 401; 404.                            |

There is no `middleware.ts` / `proxy.ts`. Each page and handler guards itself.

## Core domain rules

**Pricing model (`lib/quote.ts`).** These are pure functions, run on the server to save a quote and in the browser for display.

- Price = `systemSizeKw × $1,200` (`PRICE_PER_KW_CENTS`).
- Principal = price − down payment, and must be > 0.
- Risk band: A if kWh ≥ 400 **and** kW ≤ 6; else B if kWh ≥ 250; else C. APR is A 6.9, B 8.9, C 11.9 (`APR_BY_BAND`, stored as a percentage number: `6.9` means 6.9%).
- Offers: one per `offerTermYears` (5, 10, 15), with monthly payment `P·r / (1 − (1+r)^−n)` rounded to the cent once at the end. `monthlyPaymentCents` throws on APR ≤ 0 by design, so a 0% band also needs a zero-rate branch.
- UI copy that states these numbers reads the constants (`APR_BY_BAND`, `PRICE_PER_KW_CENTS`, `offerTermYears`), so changing the model updates the copy. `BAND_MEANING` in `lib/quote.ts` (used by the quote page and its PDF) and `bandCopy` in `app/page.tsx` describe the band thresholds in prose; update them alongside `riskBand()`.

**Money is integer US cents** everywhere it is stored, compared or summed. Column and field names end in `_cents` / `Cents`. Convert to dollars only at the edges: `toCents` when parsing a request, `fromCents` in `toQuoteResponse`, and `formatCents` (optionally `{ wholeDollars: true }`) for display. kWh, kW and APR are `numeric` columns with `mode: "number"`, which keeps them plain JS numbers.

**Saved quotes are snapshots.** A quote stores its inputs (including name, email and address copied from the form) and every derived value (`systemPriceCents`, `principalCents`, `riskBand`, `apr`, `offers` as JSONB), so old quotes keep their numbers after a pricing change. Amortization schedules (`lib/amortization.ts`) are rebuilt client-side from the saved offer and are never stored. The schedule rounds interest monthly, and the last payment absorbs the drift.

**Validation (`lib/quote-schema.ts`).** One Zod schema is shared by the API route and the browser form (which pre-validates before fetching). It is a `strictObject`: an unknown key is a field error, since a misspelt `downPayment` would otherwise become $0. It allows at most two decimals (to match the column precision), uses sanity caps (100 kW, 100,000 kWh), and adds a cross-field refine requiring the down payment to be less than the price. It transforms `downPayment` (dollars) into `downPaymentCents`. User-facing messages are complete sentences ("Enter your name.").

## Auth and authorization

- Sessions are stateless: an HS256 JWT (`jose`) in an httpOnly `session` cookie that lasts 7 days and holds only `userId` (`lib/session.ts`). Rotating `SESSION_SECRET` signs everyone out.
- `getCurrentUser()` (`lib/current-user.ts`, wrapped in React `cache`) re-reads the user row on every request, so role changes apply immediately. Pages call `requireUser()` (redirects to `/login`) or `requireAdmin()`. A non-admin gets `notFound()`, a 404 rather than a 403, which keeps admin pages hidden. Route handlers call `getCurrentUser()` and return a 401 `apiError`.
- Passwords use scrypt via `lib/password.ts` (`hashPassword` / `verifyPassword`). The parameters are serialised into the hash, so they can be raised later. Login verifies against a decoy hash when the email is unknown (to resist timing attacks) and always answers "Invalid email or password."
- Emails are unique case-insensitively (`users_email_lower_unique` on `lower(email)`). Look users up with ``sql`lower(${users.email}) = lower(${email})` `` so the index serves the query. A duplicate signup is detected by catching Postgres `23505` on `error.cause` (Drizzle wraps driver errors).
- **Ownership scoping:** every user-facing query filters by both id **and** `userId` (`findQuote`, `deleteQuote`), so another user's id behaves like a missing one. `server/admin.ts` functions assume the caller already ran `requireAdmin()`.
- Validate route-param ids with `z.uuid()` before querying. Postgres throws on a malformed uuid, which would surface as a 500 instead of a 404.

## API conventions (`server/http.ts`)

- Wrap every JSON handler in `jsonRoute(...)`. It catches unexpected errors, logs every request (see Logging), and returns a generic 500 in the standard shape.
- Every error body is `{ error: { code, message, fields? } }`, built with `apiError(status, code, message)` or `validationError(zodError)`. Codes are snake_case (`validation_failed`, `unauthorized`, `not_found`, `invalid_json`, …). `fields` maps each field to its first message (`lib/field-errors.ts`).
- Read bodies with `readJson(request)`. It requires `application/json` (this doubles as the CSRF guard), caps the body at 16 KB, and returns `{ ok, body } | { ok: false, response }`.
- Check auth first, before reading the body.
- Responses serialise with `toQuoteResponse` (`server/quotes.ts`): dollars, ISO dates, and `inputs` / `derived` / `offers` groups.
- Client callers live in `lib/` as React-free functions that take an injectable `fetchImpl` (`submitQuote`, `requestQuoteDeletion`, `requestQuotePdf`) and return a discriminated-union result, with a 401-specific message and a generic network-failure message. `readApiError` tolerates non-JSON bodies.

## Logging (`lib/logger.ts`)

- Server code logs through `logger` (`logger.info("msg", { fields })`), never `console`. Messages are short and fixed ("request completed"); variable data goes in fields, so lines can be filtered. Pass an error as `err`, which is serialised with its `cause` chain (where Drizzle keeps the Postgres `code`) and Next.js `digest`.
- `jsonRoute` runs each API request inside `withLogContext({ requestId, method, path })`, logs one line when it ends (info under 400, warn for 4xx, error for 5xx with the `err`), and returns the id as `x-request-id`; an incoming plain `x-request-id` is reused. `apiError` adds `errorCode` (and `invalidFields`) to that line, `getCurrentUser` adds `userId` and `role`, and handlers add ids such as `quoteId` with `setLogContext`.
- Never log passwords, emails, names, addresses or request bodies: ids, field names and outcomes only. Auth events go through `logger.child({ source: "auth" })`.
- `instrumentation.ts` routes Next.js's own output (its `console` calls, its dev request lines, forwarded browser warnings) through the logger as `source: "next"`, and logs errors Next.js caught (pages, Server Actions) from `onRequestError`. The `▲ Next.js … Ready` banner is printed before `register()` runs, so it stays plain.
- Output is JSON lines on stdout, or one readable line per event under `next dev`. `LOG_LEVEL` and `LOG_FORMAT` override; Vitest runs with `LOG_LEVEL=silent`, so tests spy on `logger` rather than read output.

## Next.js 16 patterns used here

Read `node_modules/next/dist/docs/` before using an API you are unsure of. This version differs from older Next.js.

- **`cacheComponents: true`**: anything that reads cookies, `params` or `searchParams` renders inside a `<Suspense>` boundary with a skeleton fallback. The page shell (header, title, footer) stays static. The pattern used on every signed-in page:

  ```tsx
  export default function Page({ params }: PageProps<"/quotes/[id]">) {
    return (<>
      <AppHeader current="quotes" />
      <main className="flex-1"><div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Reads the session cookie, so it streams in behind a boundary. */}
        <Suspense fallback={<QuoteSkeleton />}><QuoteDetails params={params} /></Suspense>
      </div></main>
      <SiteFooter />
    </>);
  }
  async function QuoteDetails({ params }: { params: PageProps<"/quotes/[id]">["params"] }) {
    const [{ id }, user] = await Promise.all([params, requireUser()]);
    …
  }
  ```

- Use the generated global types `PageProps<"/route">`, `LayoutProps<"/">` and `RouteContext<"/api/...">`. `params` and `searchParams` are Promises.
- Each page exports `metadata` with a short `title`. The root layout applies the `"%s · greenQuote"` template.
- The nav's active state is passed as a prop (`<AppHeader current="new" | "quotes" | "users" admin? />`) instead of read from the URL, which keeps the nav a prerenderable Server Component.
- Server Components are the default; add `"use client"` only for interactivity. A `"use server"` file may export only async functions, which is why form-state types live in `lib/auth-form-state.ts`.
- Call `redirect()` outside `try/catch`, because it signals by throwing.
- After a client mutation, navigate inside `useTransition` (`router.push` / `router.replace` / `router.refresh`) so the pending state lasts until the next page renders.
- The quote form uses `fetch` to the JSON API (not a Server Action), so every client shares one API. The auth forms use Server Actions with `useActionState`.

## UI and styling

- Tailwind v4 with design tokens in `app/globals.css` `@theme`. Use the token utilities instead of raw palette colours:
  - Colours: `ink`, `muted`, `subtle`, `canvas`, `surface`, `sunken`, `line`, `line-strong`, `brand`, `brand-strong`, `brand-soft`, `on-brand`, `panel`, `danger`, `danger-soft`, `principal`, `interest`.
  - Other tokens: `rounded-card` / `rounded-control`, `shadow-card` / `shadow-lift`, and `animate-rise` / `animate-ken-burns` (disabled under reduced motion).
- Buttons reuse the `primaryButton` / `secondaryButton` class strings exported from `components/site-chrome.tsx`.
- Page frame: `SiteHeader` (public) or `AppHeader` (signed in), then `<main className="flex-1">` with a centred container (`mx-auto w-full max-w-6xl px-4 sm:px-6`), then `SiteFooter`. Content cards use `rounded-card border border-line bg-surface shadow-card`.
- Form inputs use `components/field.tsx` (`Field`). It supports a label, `hint`, `error` (which replaces the hint and sets `aria-invalid` / `aria-describedby`) and a unit `suffix`. Forms set `noValidate` and show a whole-form message inside an `aria-live="polite"` region with `empty:hidden`.
- Accessibility is a standing requirement: `sr-only` text on repeated links/buttons ("View<span className="sr-only"> quote from …</span>"), `<caption className="sr-only">` on tables, `scope` on headers, `aria-hidden` on decorative SVG, `aria-current` / `aria-pressed` for state, and `tabular-nums` for figures.
- Icons and art are inline SVG components. Charts are hand-rolled SVG (`amortization-chart.tsx`), and the project uses no icon or chart libraries.
- Dates render with `formatQuoteDate` (en-GB, server time zone); money renders with `formatCents`.

## Database workflow

1. Edit `db/schema.ts`: snake_case columns, `withTimezone` timestamps, `createdAt` plus `updatedAt` with `$onUpdate`, CHECK constraints for invariants, and indexes named `<table>_<cols>_idx`.
2. `pnpm db:generate`, then **read the generated SQL**. drizzle-kit can miss parts of a change. For example, `0001_quote_money_in_cents.sql` had to be hand-edited to add the type change with a `USING` conversion.
3. `pnpm db:migrate`. Explore the data with `pnpm db:studio`.

Enums and shared literal unions are declared as `as const` arrays (`userRoles`, `riskBands`, `offerTermYears`) with the type derived from them. `pgEnum` reuses the same array.

## Testing conventions

- Vitest defaults to the `node` environment. Component tests put `// @vitest-environment jsdom` on line 1 and use Testing Library with `userEvent`, calling `cleanup()` in `afterEach`.
- No test touches a real database. Mock `@/db` with a fake, thenable query builder, and keep mutable state in `vi.hoisted(() => ({ state: … }))`. Mock `@/lib/current-user`, `@/lib/session` and `next/navigation` as needed. Stub `fetch` with `vi.stubGlobal`.
- Route handlers are tested by calling the exported `POST` / `DELETE` directly with a `Request` and `{ params: Promise.resolve({...}) }`.
- Test names are behaviour sentences ("is undefined when no quote matches — missing, or another user's"). Pure `lib/` logic gets the most thorough coverage. New logic belongs in a pure `lib/` module so it can be tested without a browser.

## Code style

- Double quotes, semicolons, trailing commas, about 80 columns (Prettier-style; no formatter config is checked in).
- Import order: external packages, a blank line, `@/` imports, a blank line, relative `./` imports. Use `import type` / inline `type` for type-only imports.
- Use named exports for everything except Next.js special files (`page`, `layout`, `route`), which use default exports.
- Comments explain **why** (the trade-off, the invariant, the attack prevented), usually as a `/** … */` doc comment above an export. Match that density: this codebase documents intent generously and never narrates the obvious.
- Name constants in `UPPER_SNAKE` with units in the name (`SESSION_DURATION_MS`, `MAX_BODY_BYTES`, `PRICE_PER_KW_CENTS`). Write numeric literals with separators (`1200_00`, `100_000`).
- Write UI copy and messages in plain, friendly sentences ending in a full stop. Use British spelling in code comments ("recognised", "serialise"). User-facing currency is US dollars.

## Git workflow

- Always squash merge a branch into `main` (`git merge --squash <branch>`, then one commit), so each feature lands as a single commit. Never use a fast-forward or merge-commit merge.

## Known gaps

- `/dashboard` is an unused placeholder from before quotes existed.
- There are no profile editing, password reset or admin write actions (admin is read-only), and no pagination on the lists.
