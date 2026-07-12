# AGENTS.md — Code standards for poe2-dashboard

## Project layout

npm workspaces monorepo:

- `packages/shared` — domain types, API shapes, Zod schemas. No runtime dependencies on server or client.
- `server` — Fastify v5 backend: poe.ninja/Twitch fetchers, SQLite persistence (Drizzle), and serving the built SPA in production. DB-touching features are organized into vertical slices (see **Persistence & database**). Runs via `tsx` + Node 22 `--env-file`.
- `client` — Vite + React 19 SPA.

## TypeScript

- When a type is truly unknown, prefer `unknown` + a type guard or Zod parse over casting.
- Prefer `type` for all shapes, aliases, and unions. Reserve `interface` only when declaration merging is explicitly required.
- Never nest object shapes inline. Extract every nested object as its own named type above the parent.
- All `.ts`/`.tsx` imports use `.js` extensions — this is required for Node ESM. Do not use extensionless imports.

## Module & export style

- No barrel `index.ts` re-export files within `client/src/` or `server/src/`. Import directly from the source file.
- `packages/shared` is a proper npm package with a single declared entry point (`"exports": { ".": "./src/index.ts" }`); importing from `@poe2-dashboard/shared` is correct and intentional.

## Functions

- Use arrow functions everywhere: module-level exports, named helpers, and inline callbacks.
- Prefer implicit returns over explicit `return` statements when the body is a single expression: `const fn = () => value` over `const fn = () => { return value }`.
- In `.reduce()` calls, never name parameters `acc` or `curr`. Use a name that describes what the accumulator holds (e.g. `tagMap`, `total`, `grouped`).
- Never use single-letter names for callbacks or function parameters — name what the value represents. Exceptions: `i` as a loop index, and sort comparators where both parameters are the same type (e.g. `(a, b) => b.viewers - a.viewers`).
- When a parameter must be skipped, use `_`.
- Prefer `async`/`await` over `.then()`/`.catch()` chains. Use `void expr` to explicitly fire-and-forget a promise without await.

## Variables & destructuring

- Destructure an object property (or extract a computed value to a `const`) the moment it is read more than once. A second `obj.prop` or `obj[key]` access is the trigger: bind it once and reuse the local. Single-use accesses may stay inline.
- This is independent of the prop rule below ("Destructure all props in the function signature"), which always applies regardless of use count.

## Comments

- Default to no comments. Only add one when the **why** is non-obvious: a hidden constraint, a subtle invariant, or a workaround.
- Document field semantics where the shape is defined. Since most shared types are derived from Zod schemas via `z.infer` (which does not carry JSDoc onto the derived type), put `/** */` field docs on the schema fields. Hand-written types keep their field JSDoc directly.
- Never write comments that restate what the code already says.

## Naming

- All boolean variables and props must be prefixed with `is`: `isFetching`, `isArbitragesFetching`, `isActive`, etc. Never `fetching`, `loading`, `pending` as bare names.

## React (client)

- Derive state with `useMemo`/`useCallback` — don't store things in state that can be computed.
- Props are defined as a `type` named `<ComponentName>Props` directly above the component. Destructure all props in the function signature.
- Keep components focused. Extract pure utility logic shared across widgets to `src/lib/`.
- Never pass through props what can be accessed through a hook — this applies to query data, context values, and utility hooks. If a component can call the hook itself, it should.
- Query hooks created by `createResourceQuery` use `useSuspenseQuery` — data is always defined, no null checks needed. Widgets do not wrap in any guard component; loading and error states are handled by `<Suspense>` and `<ErrorBoundary>` in the layout.
- Query hooks expose resource-named properties — no generic terms (`isPending`, `refetch`, `data`, `error`) on the result. Destructure directly; never alias:
  - `<resource>` — the data
  - `refetch<Resource>` — trigger a manual refetch
  - `is<Resource>Fetching` — true while any fetch (initial or background) is in flight

  ```ts
  const { arbitrages, refetchArbitrages, isArbitragesFetching } = useArbitrages()
  const { buildTrends, refetchBuildTrends, isBuildTrendsFetching } = useBuildTrends()
  ```

- Server-reported errors in the response body (e.g. `lastError`, `streamsError`) are shown inline within the widget; they do not bubble to the error boundary.

## Data fetching (client)

- All server data is fetched via TanStack Query (`@tanstack/react-query`).
- Every query hook is built by `createResourceQuery` (in `src/lib/`), which owns the query key, the default `refetchInterval`, and the resource-named property renaming. Do not hand-write `queryOptions`/`useQuery` per resource.
- Each resource lives in `client/src/api.ts` as a `fetch<Resource>` function followed immediately by the `createResourceQuery({ name, fetcher, transform? })` call that exports its `use<Resource>` hook. Fetcher and query instantiation are co-located; there are no per-widget `query.ts` files.
- Resource names are registered in the `RESOURCES` tuple and `ResourceDataMap` in `createResourceQuery.ts`. Add a new resource there first, then add its fetcher + hook in `api.ts`.
- Query key pattern: `["resource", ...params]`. The factory builds keys automatically; a parameterized fetcher's params object becomes part of the key.
- Never call `fetch` directly from a component. Fetch logic stays in `client/src/api.ts`; the factory's `queryFn` calls into it.
- Apply data transforms (filtering, aggregation) via the `transform` option, not in component `useMemo` calls. The component receives ready-to-render data.
- `error` from a query is `Error | null` — use `.message` when forwarding to the UI.

## Validation & types

- **Zod schemas are the single source of truth for data shapes.** Types are derived from schemas with `z.infer` — never hand-write a type that duplicates a schema. `export type Arbitrage = z.infer<typeof ArbitrageSchema>`.
- Shared domain + API-contract schemas live in `packages/shared/src/schemas.ts`; their derived types live alongside their domain in `domain.ts`, `api.ts`, and `twitch.ts`, importing the schema with `import type`.
- External-boundary wire schemas live with the server fetcher that parses them, never in shared (a runtime schema in shared risks being bundled into the client): poe.ninja in `server/src/poeNinja.ts`, Twitch raw responses in `server/src/twitch.ts`. Their derived types are exported from those modules.
- Use Zod to parse data at **system boundaries**: poe.ninja API responses, Twitch API responses, and the client validating the server's own API responses.
- Do not use Zod for internal function arguments — trust TypeScript there. Do not add schemas for internally-computed shapes that never cross a boundary (e.g. `RateEdge`, `Snapshot`); those stay as hand-written types.
- Extract every nested object as its own named schema (mirroring the no-inline-nesting type rule), so the derived type has a name too.

## Persistence & database (server)

- Storage is SQLite via **Drizzle ORM** over `better-sqlite3`, schema-first. The single connection (`server/src/db/client.ts`) runs under WAL with `synchronous = NORMAL` and `foreign_keys = ON`.
- **Migrations are generated, never hand-written.** Run `npm run db:generate -w server` (`drizzle-kit generate`) after a schema change and commit the SQL in `server/drizzle/`. Never edit a generated migration by hand. Migrations are applied at boot by `runMigrations()` — the single-container deploy has no separate migrate step.
- **`better-sqlite3` is synchronous.** DB code is straight-line — no `await` on queries. Inside `db.transaction(cb)` the callback is sync: use `.get()`/`.all()`/`.run()`, and relational reads (`db.query.<table>.findFirst({ with })`) with `.sync()`.
- **Never write raw SQL.** Use the Drizzle query builder / relational queries. A raw `sql` template fragment is a last resort and needs a comment justifying it.

### Slice architecture

Every server feature that touches the DB is a self-contained vertical slice under `server/src/slices/<slice>/`:

- `<slice>.schema.ts` — Drizzle tables + `relations`. `drizzle.config.ts` globs `src/slices/**/*.schema.ts` and `db/client.ts` spreads every slice's schema namespace into the one client (so `db.query` is typed across slices) — adding a slice is picked up by both automatically.
- `<slice>.router.ts` — Fastify routes, registered under a `/api/<slice>` prefix. Validates request params with the shared Zod schemas; issues **no** DB calls itself.
- `<slice>.service.ts` — business logic. **Owns `db.transaction`** and is the only layer that opens one; composes db functions inside it.
- `dbFunctions/` — one file per operation (`insertStrategyRow`, `deleteTabletRows`, …), the **only** place a query is issued. Each takes the `DbTransaction` handle as its first parameter.
- `<slice>.dto.ts` — maps between DB row types (`InferInsertModel`/`InferSelectModel`) and the shared API types; owns the db-model types the db functions import.

**The write path is layered and never skipped:** router (Zod-validate) → service (`db.transaction`) → db functions (queries). **Wrap every DB trip — reads included — in a transaction.**

### Persistence conventions

- **Text UUID primary keys** (`crypto.randomUUID()`), generated server-side on create — never client-supplied — for future multi-device merge-ability. (Some seeded legacy rows keep hand-written slug ids.)
- Timestamps are **ms-epoch integers** (`createdAt`/`updatedAt`), matching the repo's `fetchedAt` convention.
- Child tables reference their parent with `onDelete: 'cascade'`; use a composite PK where it encodes intent (the `(strategyId, tag)` PK makes tags a set).
- The economy snapshot is a **restart cache, not history**: one upserted row per league. Trend-over-time is poe.ninja's job — do not add snapshot history.

## Testing

- Don't test DB writes (trust Drizzle) or pure DTO/shape transforms (TypeScript already proves the input→output shape).
- Do test non-trivial computation — the arbitrage/graph math in `packages/shared/test` is the model. Run with `npm test`.

## Error handling

- Pollers catch their own errors and write to a `lastError: string | null` field on state. The server always serves the last good snapshot alongside the error.
- Never swallow errors silently. Either surface them in state or rethrow.
- Use `console.warn` for non-fatal degraded paths (e.g. poe.ninja skills fetch failing). Use `console.error` for poll failures.

## Security

- **Credentials never go in code.** Environment variables only, loaded via `.env` (gitignored).
- `.env.example` documents every required variable with placeholder values.
- The Twitch client ID and secret were previously compromised. Rotate before any deployment.

## What not to do

- Do not add error handling for impossible cases — trust internal invariants.
- Do not add abstractions speculatively. Three similar lines is better than a premature helper.
- Do not add features beyond what the task requires.
- Do not create `README.md` or documentation files unless explicitly asked.
