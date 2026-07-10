/**
 * One-time import of the legacy JSON store (packages/shared/data/atlas-strats.json)
 * into the atlas_strategies table. Idempotence guard: refuses to run against a
 * non-empty table, so re-running can't duplicate or clobber anything.
 *
 * Usage: npm run db:seed -w server   (respects DB_PATH like the server itself)
 */
import { readFileSync } from 'node:fs'

import { AtlasResponseSchema } from '@poe2-dashboard/shared'
import { ATLAS_DATA_PATH } from '@poe2-dashboard/shared/atlas'

import { db, runMigrations } from '../src/db/client.js'
import { toStrategyColumns, toTabletRows, toTagRows } from '../src/slices/atlas/atlas.dto.js'
import { insertStrategyRow } from '../src/slices/atlas/dbFunctions/insertStrategyRow.js'
import { insertTabletRows } from '../src/slices/atlas/dbFunctions/insertTabletRows.js'
import { insertTagRows } from '../src/slices/atlas/dbFunctions/insertTagRows.js'
import { selectStrategyRows } from '../src/slices/atlas/dbFunctions/selectStrategyRows.js'

runMigrations()

const { strategies } = AtlasResponseSchema.parse(JSON.parse(readFileSync(ATLAS_DATA_PATH, 'utf8')))

const inserted = db.transaction(tx => {
  const existing = selectStrategyRows(tx)
  if (existing.length > 0) {
    console.log(`[seed-atlas] table already has ${existing.length} strategies; nothing to do.`)
    return 0
  }
  const now = Date.now()
  for (const strategy of strategies) {
    // Legacy ids (slugs and client-era UUIDs) are preserved as-is; only
    // strategies created through the API get server-generated ids.
    insertStrategyRow(tx, {
      ...toStrategyColumns(strategy),
      id: strategy.id,
      createdAt: now,
      updatedAt: now,
    })
    insertTabletRows(tx, toTabletRows(strategy.id, strategy.tablets))
    insertTagRows(tx, toTagRows(strategy.id, strategy.tags))
  }
  return strategies.length
})

if (inserted > 0) {
  console.log(`[seed-atlas] imported ${inserted} strategies from ${ATLAS_DATA_PATH}`)
}
