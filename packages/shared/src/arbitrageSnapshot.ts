import { fileURLToPath } from 'node:url'

/**
 * Absolute path to the persisted Arbitrage snapshot cache. The server rewrites it
 * after each successful poll and reads it on startup to render the last good data
 * while the first (multi-minute) poll runs. Like ATLAS_DATA_PATH it lives in the
 * shared package's data dir — outside any app's source tree — so runtime writes
 * don't trip the client dev server's watcher or tsx's server-restart watch (which
 * would re-poll on every write).
 *
 * This module pulls in a Node builtin, so it is intentionally NOT re-exported from
 * the package index: only the server imports it (via the `./arbitrageSnapshot`
 * subpath), keeping `node:url` out of the browser bundle.
 */
export const ARBITRAGE_SNAPSHOT_PATH = fileURLToPath(
  new URL('../data/arbitrage-snapshot.json', import.meta.url),
)
