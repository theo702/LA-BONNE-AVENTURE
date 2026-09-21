# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Cloudflare Pages + Functions** app ("La Bonne Aventure" — a direct
vacation-rental booking engine). The static site lives at the repo root
(`index.html`, `extras.html`, `guide.html`, `admin.html`, `assets/`) and the API is the
`functions/` directory (Pages Functions). Config, bindings and non-secret vars are in
`wrangler.toml`; the D1 schema is `schema.sql`. See `README-deploiement.md` for the full
(production) deployment guide.

There is **no build step, no lint config, and no test suite** — do not look for `npm run
build/lint/test`. `package.json`/`package-lock.json`/`node_modules` are gitignored, and
`wrangler` is installed by the startup update script (`npm install wrangler@4`), so use
`npx wrangler ...`. Running `wrangler pages dev` compiles the Functions Worker, which acts
as the effective build/typecheck ("Compiled Worker successfully").

### Local dev services (run manually; not started by the update script)

The single dev service is the Pages dev server. Two one-time local setup steps are needed
because their outputs are gitignored (they may or may not survive a VM snapshot, so
recreate them if missing):

1. Create `.dev.vars` (gitignored) from `.dev.vars.example`. For local dev the only value
   that must be real is `ADMIN_PASSWORD` (used by `/api/admin/login`). Stripe / Resend /
   Airbnb keys can stay dummy values unless you are testing checkout, webhooks, emails, or
   iCal sync — those endpoints call external services and need real test keys.
2. Seed the local D1 database with the schema (idempotent — `CREATE TABLE IF NOT EXISTS`):
   `npx wrangler d1 execute lba-bookings --local --file=./schema.sql`

Then start the dev server:
`npx wrangler pages dev . --port 8788 --ip 0.0.0.0`

**Important (non-obvious) D1 gotcha:** run `wrangler pages dev` **without** the
`--d1 DB=lba-bookings --kv CACHE` flags shown in `README-deploiement.md`. Those flags make
`pages dev` create its own local D1 keyed differently from the DB that
`wrangler d1 execute --local` seeds (which uses the `database_id` in `wrangler.toml`), so
the seeded tables are invisible and API calls fall back to `wrangler.toml [vars]` defaults
(e.g. availability silently returns `nightlyCents 6000` instead of the D1 value). Relying
on the bindings already declared in `wrangler.toml` makes both commands share the same
local D1. Local state persists under `.wrangler/state` (gitignored).

Note: on first request the app auto-applies tier pricing to D1 (`seedTierPricingOnce`) and
seeds a demo promo, so a freshly-seeded DB reports `nightlyCents 12000, minNights 1`.

### Quick smoke test

- Static site: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8788/` → `200`
- Server-side quote: `curl -s -X POST http://127.0.0.1:8788/api/quote -H 'content-type: application/json' -d '{"checkin":"2026-09-10","checkout":"2026-09-13","guests":2}'`
- Admin write path: `POST /api/admin/login` with `{"password":"<ADMIN_PASSWORD>"}` to get
  the `lba_admin` cookie, then `POST /api/admin/promos` to create a promo code.
