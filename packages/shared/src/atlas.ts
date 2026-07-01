import { fileURLToPath } from 'node:url'

/**
 * Absolute path to the persisted Atlas strategies store. The server reads it on
 * GET /api/atlas and rewrites it on PUT /api/atlas, so it must stay a real file
 * on disk (not a bundled import). It lives in the shared package — outside any
 * app's source tree — so runtime writes don't trip the client dev server's file
 * watcher and force a full page reload.
 *
 * This module pulls in a Node builtin, so it is intentionally NOT re-exported
 * from the package index: only the server imports it (via the `./atlas` subpath),
 * keeping `node:url` out of the browser bundle.
 */
export const ATLAS_DATA_PATH = fileURLToPath(new URL('../data/atlas-strats.json', import.meta.url))
