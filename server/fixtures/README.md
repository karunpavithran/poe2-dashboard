# Fixtures

Captured poe.ninja payloads kept as provenance for the wire-format Zod schemas
in `src/poeNinja.ts` (the comment there points at `overview.json`). Real
captures are gitignored; only this README and hand-built examples are committed.

## How to capture a fresh payload

1. Open the current league's currency page, e.g.
   `https://poe.ninja/poe2/economy/runesofaldur/currency`, in a browser.
2. Open DevTools → Network tab, filter to Fetch/XHR, reload the page.
3. Find the request that returns the currency exchange data. Note its **full
   URL and query params** and any non-default request headers.
4. Right-click the request → Copy → Copy response, and save it here as
   `overview.json`.
5. Reconcile `src/poeNinja.ts` (URL, headers, the Zod schemas, `buildEdges`)
   with the real payload. The `PoeNinja*` types are derived from those schemas
   via `z.infer`, so changing a schema updates its type.
