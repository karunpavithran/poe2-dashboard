# poe2-dashboard

Finds triangular arbitrage opportunities in Path of Exile 2's in-game currency
exchange using poe.ninja data. Informational only — trades are executed
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
                   persist snapshot           │  hub maps, gzipped       findTriangularArbitrages     rates,
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
- `server` — Fastify (+ `@fastify/compress`); polls poe.ninja, normalizes to
  edges, serves the snapshot. `fetch-extras` for rate-limit/retry, `pbf` for
  schema-less protobuf decode of the builds feed, `@anthropic-ai/sdk`
  (Claude Haiku 4.5) to tag Twitch stream titles
- `client` — React 19 + Vite SPA; TanStack Query (the derivation runs in its
  transform, so the cache doubles as the derived-view store) + Table,
  Radix/shadcn/Tailwind v4, react-router; talks to the backend via the Vite
  dev proxy

## Setup

```sh
npm install
npm test          # arbitrage math unit tests
npm run dev:server
npm run dev:client   # separate terminal; opens on http://localhost:5173
```

## Data source

Two verified endpoints (June 2026), base
`https://poe.ninja/poe2/api/economy/exchange/current`:

```
GET /overview?league=<league>&type=Currency
GET /details?league=<league>&type=Currency&id=<detailsId>
```

The overview lists all currencies (with each one's busiest-market rate via
`maxVolumeCurrency`/`maxVolumeRate`); the details page lists a currency's
observed outbound rates against the core hubs (divine/exalted/chaos) plus
daily history. Crucially, **the two directions of a pair are independently
observed** — e.g. divine→exalted 128.4 while exalted→divine 0.007745, a real
−0.56% round-trip spread — so the graph is built from observed rates only and
never inverts a rate (inversion would fabricate a spread-free market). Each
poll = 1 overview + ~49 details requests at concurrency 4.

Volumes are denominated in primary-currency (divine) units, so the min-volume
filter is "at least this much divine-equivalent daily volume on the cycle's
thinnest leg." Thin markets can show large on-paper profits (a mispriced
low-volume pair); the volume filter is what separates those from executable
opportunities.

## Environment variables (server)

| Variable           | Default          | Purpose                                |
| ------------------ | ---------------- | -------------------------------------- |
| `LEAGUE`           | `Runes of Aldur` | poe.ninja league name (case-sensitive) |
| `POLL_INTERVAL_MS` | `3600000`        | poe.ninja poll cadence                 |
| `PORT`             | `3000`           | backend port                           |

## Later

- Electron container: main process spawns the server, renderer loads the built
  SPA — client already only talks to localhost-relative `/api`.
- SQLite (`better-sqlite3`) behind the poller if opportunity history is wanted.
