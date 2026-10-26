# greenQuote

Solar pre-qualification quotes. A signed-in user enters their address, monthly
electricity use and system size, and gets a price, a risk band, an interest
rate and three payment plans (5, 10 and 15 years). Quotes are saved to the
user's account, and an admin can view every user's quotes.

Built with Next.js, TypeScript and PostgreSQL.

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (keep it
  running while you use the app)
- For Option B (developer path) only:
  [Node.js 24](https://nodejs.org/en/download) and pnpm (run
  `corepack enable` once after installing Node)

## 1. Get the code

```bash
git clone https://github.com/ammar2168/green-quote.git
cd green-quote
```

## 2. Create your settings file

```bash
sh scripts/init-env.sh
```

This creates `.env` with a random `SESSION_SECRET`. The defaults work as they
are. Running it again leaves an existing secret alone.

## 3. Start the app

Pick **one** option and stick with it for the rest of this guide.

**Option A: Docker only path (easiest, no Node.js needed)**

```bash
docker compose --profile app up -d --build
```

**Option B: Developer path (for editing code)**

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

## 4. Create the admin account

Choose a password (8+ characters) and run the command for the option you
picked in step 3.

**Option A: Docker only path**

```bash
docker compose run --rm migrate pnpm db:seed:admin 'YourPassword'
```

**Option B: Developer path** (open a second terminal in the `green-quote`
folder, because `pnpm dev` is still running in the first)

```bash
pnpm db:seed:admin 'YourPassword'
```

Run it again any time to reset the password.

## 5. Open the app

**Whichever option you chose**, open <http://localhost:3000> in your browser.
You should see the greenQuote home page.

- **Admin:** sign in at <http://localhost:3000/login> with email
  `admin@greenquote` and the password from step 4.
- **Normal user:** create an account at <http://localhost:3000/signup>.

Option B only: leave the `pnpm dev` terminal open while you use the app.

## API

| Route                            | What it does                                    |
| -------------------------------- | ----------------------------------------------- |
| `POST /api/quotes`               | Create and save a quote                         |
| `DELETE /api/quotes/{id}`        | Delete one of your quotes                       |
| `GET /api/quotes/{id}/pdf?term=` | Download a quote as a PDF (`term`: 5, 10 or 15) |
| `GET /api/health`                | Check the app and database are up               |
| `GET /api/openapi.json`          | The OpenAPI specification                       |

The quote routes need you to be signed in. Full details and a way to try the
requests are at <http://localhost:3000/docs>.

## Stopping

- Option A (Docker only): `docker compose --profile app down`
- Option B (developer): `Ctrl + C` in the terminal, then `docker compose down`

Your data is kept. Add `-v` to the `down` command to wipe it.

## Troubleshooting

| Problem                     | Fix                                                                               |
| --------------------------- | --------------------------------------------------------------------------------- |
| `Cannot connect to Docker`  | Open Docker Desktop and wait until it's running.                                  |
| Port 5432 already in use    | Set `POSTGRES_PORT=5433` in `.env` and change `5432` to `5433` in `DATABASE_URL`. |
| Port 3000 already in use    | Option A: set `APP_PORT=3001` in `.env`. Option B: `pnpm dev --port 3001`.        |
| `SESSION_SECRET is not set` | Run `sh scripts/init-env.sh` (step 2).                                            |
| `pnpm: command not found`   | Run `corepack enable`, then open a new terminal.                                  |

## Development

`pnpm test --run`, `pnpm typecheck`, `pnpm lint` and `pnpm format:check` must
pass before a change is done. See [CLAUDE.md](CLAUDE.md) for architecture and
conventions.

## End-to-end tests

These drive a real browser through sign-in and the quote flow. They use the
developer path (Option B) setup.

```bash
docker compose up -d                    # the database must be running
pnpm exec playwright install chromium   # first time only
pnpm test:e2e
```

The tests create their own throwaway database (`green_quote_e2e`), build the
app and run it on port 3200, then delete the database when they finish. Your
normal data is never touched, and `pnpm dev` can keep running alongside.

- Watch the tests in a browser window: `pnpm test:e2e --ui`
- Keep the test database to inspect after a failure: `E2E_KEEP_DB=1 pnpm test:e2e`

## Things to do later

- **Continuous integration.** On every push and pull request, a CI job runs:
  1. unit tests, typecheck, lint and format check
  2. end-to-end tests (CI starts its own Postgres service)
  3. only if all pass, builds the Docker image (and later pushes it for
     deploys)
- Profile editing and password reset.
- Pagination on the quote and user lists.
