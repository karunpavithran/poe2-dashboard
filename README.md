# poe2-dashboard

Finds triangular arbitrage opportunities in Path of Exile 2's in-game currency
exchange using poe.ninja data. Informational only — trades are executed
manually in-game.

## Layout

- `packages/shared` — TS types shared by server and client (poe.ninja payload,
  domain model, API contract)
- `server` — Fastify backend: polls poe.ninja every ~2 min, builds a directed
  rate graph, brute-forces 3-currency cycles, serves
  `GET /api/opportunities?minProfit=&minVolume=`
- `client` — Vite + React SPA: auto-refreshing opportunity table with filter
  controls; talks to the backend via the Vite dev proxy

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
