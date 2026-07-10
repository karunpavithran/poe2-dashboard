import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as atlasSchema from '../slices/atlas/atlas.schema.js'
import * as economySchema from '../slices/economy/economy.schema.js'

/**
 * DB file location: DB_PATH env (the Docker volume mount point on the Pi) or a
 * gitignored data/ dir in the server package for dev. Resolved from this module's
 * URL, not cwd, for the same reason as ATLAS_DATA_PATH. Must stay in sync with
 * the dev default in drizzle.config.ts.
 */
const dbPath =
  process.env.DB_PATH ?? fileURLToPath(new URL('../../data/poe2-dashboard.db', import.meta.url))

// better-sqlite3 refuses to create the DB file into a missing directory.
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
// WAL allows readers during the poller's writes; NORMAL keeps durability at
// checkpoint granularity, which is the right trade for the Pi's flash storage.
// Foreign keys are off by default in SQLite and must be opted into per-connection.
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('foreign_keys = ON')

/**
 * Schema-aware Drizzle client. Every slice's schema namespace is spread in so the
 * relational query API (`db.query.<table>`) is fully typed across slices.
 */
export const db = drizzle(sqlite, { schema: { ...atlasSchema, ...economySchema } })

/**
 * The transaction handle services pass down to db functions — every DB trip goes
 * through `db.transaction`, and db functions are the only place issuing queries,
 * so they all take this as their first parameter. Extracted from `db.transaction`
 * itself because drizzle doesn't export a ready-made type for it.
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Applies the committed migrations in server/drizzle/ (no-op when up to date).
 * Called at server boot — the single-container deploy has no separate deploy
 * step, so boot is the migration point. Synchronous, like the driver.
 */
export const runMigrations = (): void => {
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) })
}
