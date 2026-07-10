import { fileURLToPath } from 'node:url'

/**
 * Absolute path to the LEGACY Atlas strategies JSON store. Strategies now live in
 * the server's SQLite database; this file is read only by the one-time import
 * (server/scripts/seed-atlas.ts) and is otherwise kept as a pre-DB backup.
 *
 * This module pulls in a Node builtin, so it is intentionally NOT re-exported
 * from the package index: only the server imports it (via the `./atlas` subpath),
 * keeping `node:url` out of the browser bundle.
 */
export const ATLAS_DATA_PATH = fileURLToPath(new URL('../data/atlas-strats.json', import.meta.url))
