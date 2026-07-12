# poe2-dashboard

Finds triangular arbitrage opportunities in Path of Exile 2's in-game currency
exchange using poe.ninja data, plus an atlas-strategy tracker, build trends,
and a tagged Twitch stream list. Informational only — trades are executed
manually in-game.

## Architecture

**Edges-first: normalize at the boundary, derive at the edge.** The server
ships the _minimal economy source_ — raw exchange edges plus the per-currency
value/icon maps and hub names — and the client derives every view (arbitrage
cycles, per-hub buy/sell rates, currency→category) from those edges. Filtering
happens client-side over the derived rows, so `GET /api/arbitrages` takes no
query params, returns the full set once, and is cached.

Why: the payload was ~588 KB of denormalized precomputed views (the cycle list
alone was 53%). Shipping the normalized source instead dropped it to ~271 KB
raw / ~54 KB gzipped (`@fastify/compress`) — and because the derivations are
framework-free pure functions in `packages/shared` that run identically on
server or client, a new view became a client-only change instead of a
schema + poller + server change.

```text
poe.ninja          server (poller)            │  the boundary          client (react-query)         views
────────────       ───────────────            │  ────────────          ────────────────────         ─────
economy +      →   rate-limited fan-out   →   │  GET /api/arbitrages →  deriveEconomy (cached):   →  Exchanges
builds feed        normalize to edges         │  edges + value/icon/     buildGraph                  (arbitrage,
                   persist snapshot to SQLite │  hub maps, gzipped       findTriangularArbitrages     rates,
                   serve last-good on error   │                          computeBestExchange          explorer)
                   skip-if-running guard      │                          computeCurrencyCategories
```

The economy is a **directed weighted graph**: currencies are nodes, observed
rates are edges, and arbitrage is a cycle whose rate product exceeds 1. With a
few dozen currencies, brute-forcing all ordered triples
(`rate(A→B)·rate(B→C)·rate(C→A) > 1`, rotations canonicalized, both directions
kept) is ~10⁵ checks — no Bellman-Ford needed. Every category prices against
the same divine/exalted/chaos hub, so all categories merge into one graph and
cycles can route across them.

### Packages

- `packages/shared` — framework-free domain core (graph + arbitrage math) and
  the Zod request/response contracts validated on both ends; one runtime dep
  (`zod`), unit-tested with Vitest
- `server` — Fastify (+ `@fastify/compress`, `@fastify/static` for the built
  SPA); polls poe.ninja, normalizes to edges, serves the snapshot, and hosts
  the atlas CRUD API. `fetch-extras` for rate-limit/retry, `pbf` for
  schema-less protobuf decode of the builds feed, `@anthropic-ai/sdk`
  (Claude Haiku 4.5) to tag Twitch stream titles
- `client` — React 19 + Vite SPA; TanStack Query (the derivation runs in its
  transform, so the cache doubles as the derived-view store) + Table,
  Radix/shadcn/Tailwind v4, react-router; talks to the backend via the Vite
  dev proxy. Widgets: arbitrage, exchanges, atlas, trends, streams

Server features live in vertical slices (`server/src/slices/<feature>/`): each
slice owns its Drizzle schema, DTO mappers, service, router, and `dbFunctions/`
(one file per query — the only place SQL is issued; services compose them
inside `db.transaction`).

### Persistence

SQLite via `better-sqlite3` + Drizzle (WAL, foreign keys on; migrations in
`server/drizzle/` are applied at boot — the single-container deploy has no
separate migrate step). Two slices share the one DB file:

- **economy** — a restart cache, deliberately not history: each poll upserts
  ONE snapshot row per league (plus child edge/currency rows), so the server
  can serve last-good data immediately after a restart. Trend-over-time is
  poe.ninja's job.
- **atlas** — user-authored atlas strategies (normalized into strategy /
  tablet / tag tables) behind `GET/POST/PUT/DELETE /api/atlas`. Seeded
  idempotently by `server/scripts/seed-atlas.ts` when the table is empty.

## Setup

```sh
npm install
npm test          # arbitrage math unit tests
npm run dev:server
npm run dev:client   # separate terminal; opens on http://localhost:5173
```

The dev DB is created automatically at `server/data/poe2-dashboard.db`
(gitignored). Optional: `npm run db:seed -w server` loads the sample atlas
strategies and an economy snapshot; `npm run db:generate -w server` emits a
migration after a schema change.

## Data source

Two endpoints (verified June 2026), base
`https://poe.ninja/poe2/api/economy/exchange/current`:

```text
GET /overview?league=<league>&type=<category>
GET /details?league=<league>&type=<category>&id=<detailsId>
```

`type` selects one of 14 tradeable categories (`Currency`, `Fragments`,
`Runes`, `Essences`, `Breach`, …). Every category prices against the same
divine/exalted/chaos hub, so a poll fetches them all and merges their edges
into one rate graph — which is what lets arbitrage cycles route across
categories. `Currency` is the required anchor (it resolves the hub names, and
its failure fails the whole poll); any other category that errors is logged and
skipped so one dead category can't sink the snapshot.

Per category, the overview lists its currencies (each with its busiest-market
rate via `maxVolumeCurrency`/`maxVolumeRate`) and each details page lists a
currency's observed outbound rates against the core hubs plus daily history.
Crucially, **the two directions of a pair are independently observed** — e.g.
divine→exalted 128.4 while exalted→divine 0.007745, a real −0.56% round-trip
spread — so the graph is built from observed rates only and never inverts a
rate (inversion would fabricate a spread-free market).

A full poll is one overview + every item's details for each of the 14
categories — hundreds of requests. Details run 4-at-a-time within a category,
all behind a shared 3-request/second limiter with exponential 429 backoff
(`fetch-extras`), so a cold poll takes minutes — which is why the restart cache
and the on-demand refresh (rather than tight auto-polling) exist.

Volumes are denominated in primary-currency (divine) units, so the min-volume
filter is "at least this much divine-equivalent daily volume on the cycle's
thinnest leg." Thin markets can show large on-paper profits (a mispriced
low-volume pair); the volume filter is what separates those from executable
opportunities.

## Environment variables (server)

| Variable                                    | Default                         | Purpose                                            |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `LEAGUE`                                    | `Runes of Aldur`                | poe.ninja league name (case-sensitive)             |
| `POLL_INTERVAL_MS`                          | `3600000`                       | poe.ninja poll cadence                             |
| `PORT`                                      | `3000`                          | backend port                                       |
| `HOST`                                      | `127.0.0.1`                     | bind address (Docker image sets `0.0.0.0`)         |
| `DB_PATH`                                   | `server/data/poe2-dashboard.db` | SQLite file (Docker image sets the `/data` volume) |
| `CLIENT_DIST`                               | unset                           | if set, serve the built SPA from this dir          |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | unset                           | enables the streams widget                         |
| `ANTHROPIC_API_KEY`                         | unset                           | enables Claude tagging of stream titles            |

Dev reads them from a gitignored `.env` at the repo root
(`node --env-file`); the Pi keeps its own `.env` next to the compose file.

## Deployment

Single container (multi-stage `Dockerfile`, Debian-slim so better-sqlite3's
arm64 prebuilds work on a Raspberry Pi): builds the SPA, then runs the Fastify
server, which serves both `/api` and the static client, with the SQLite file
on a `/data` volume. `docker compose up` builds and runs it locally.

Pushes to `main` trigger `.github/workflows/deploy.yml`: checks (typecheck,
tests, lint, format) → native-arm64 image build pushed to GHCR (`latest` +
`sha-<commit>` for rollback) → SSH to the Pi over an ephemeral Tailscale node,
ship `docker-compose.pi.yml`, `docker compose pull && up -d`, health-check
`/api/health`. Rollback on the Pi:
`IMAGE_TAG=sha-<commit> docker compose up -d`.

## Later

- Electron container: main process spawns the server, renderer loads the built
  SPA — client already only talks to localhost-relative `/api`.
