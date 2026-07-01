# AGENTS.md — Code standards for poe2-dashboard

## Project layout

npm workspaces monorepo:

- `packages/shared` — domain types, API shapes, Zod schemas. No runtime dependencies on server or client.
- `server` — Fastify v5 backend, pollers, business logic. Runs via `tsx` + Node 22 `--env-file`.
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
