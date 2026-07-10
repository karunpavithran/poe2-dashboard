/**
 * One-time import of the legacy JSON snapshot cache (previously written by the
 * poller after each poll) into the economy tables, so the first DB-backed
 * startup still renders immediately. Guarded: skips when the league already has
 * snapshots or the legacy file is gone.
 *
 * Usage: npm run db:seed -w server   (respects DB_PATH like the server itself)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { EconomySnapshotSchema } from '@poe2-dashboard/shared'

import { runMigrations } from '../src/db/client.js'
import { loadSnapshot, saveSnapshot } from '../src/slices/economy/economy.service.js'

const LEGACY_CACHE_PATH = fileURLToPath(
  new URL('../../packages/shared/data/arbitrage-snapshot.json', import.meta.url),
)

let raw: string
try {
  raw = readFileSync(LEGACY_CACHE_PATH, 'utf8')
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    console.log('[seed-economy] no legacy snapshot cache found; nothing to import.')
    process.exit(0)
  }
  throw err
}

runMigrations()

const snapshot = EconomySnapshotSchema.parse(JSON.parse(raw))

if (loadSnapshot(snapshot.league) !== undefined) {
  console.log(`[seed-economy] "${snapshot.league}" already has a snapshot; nothing to do.`)
} else {
  saveSnapshot(snapshot)
  console.log(
    `[seed-economy] imported 1 snapshot (${snapshot.edges.length} edges, ` +
      `fetchedAt=${new Date(snapshot.fetchedAt).toISOString()}) for "${snapshot.league}"`,
  )
}
