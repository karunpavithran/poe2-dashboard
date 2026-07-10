import type { AtlasStrategy, AtlasStrategyInput } from '@poe2-dashboard/shared'

import { db } from '../../db/client.js'
import { toAtlasStrategy, toStrategyColumns, toTabletRows, toTagRows } from './atlas.dto.js'
import { deleteStrategyRow } from './dbFunctions/deleteStrategyRow.js'
import { deleteTabletRows } from './dbFunctions/deleteTabletRows.js'
import { deleteTagRows } from './dbFunctions/deleteTagRows.js'
import { insertStrategyRow } from './dbFunctions/insertStrategyRow.js'
import { insertTabletRows } from './dbFunctions/insertTabletRows.js'
import { insertTagRows } from './dbFunctions/insertTagRows.js'
import { selectStrategyRows } from './dbFunctions/selectStrategyRows.js'
import { updateStrategyRow } from './dbFunctions/updateStrategyRow.js'

/** Most recently updated first — new and just-edited strategies surface on top. */
export const listStrategies = (): AtlasStrategy[] =>
  db.transaction(tx => selectStrategyRows(tx)).map(toAtlasStrategy)

/**
 * The response body: the input as stored. Tags are echoed deduplicated because
 * the (strategyId, tag) PK gives them set semantics in the DB.
 */
const asStored = (id: string, input: AtlasStrategyInput): AtlasStrategy => ({
  id,
  ...input,
  tags: [...new Set(input.tags)],
})

/** Ids are server-generated — never client-supplied. */
export const createStrategy = (input: AtlasStrategyInput): AtlasStrategy =>
  db.transaction(tx => {
    const now = Date.now()
    const row = insertStrategyRow(tx, {
      ...toStrategyColumns(input),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })
    insertTabletRows(tx, toTabletRows(row.id, input.tablets))
    insertTagRows(tx, toTagRows(row.id, input.tags))
    return asStored(row.id, input)
  })

/**
 * Full replace (PUT semantics): parent columns are updated and the child rows
 * are deleted + reinserted. Undefined when the id doesn't exist.
 */
export const updateStrategy = (id: string, input: AtlasStrategyInput): AtlasStrategy | undefined =>
  db.transaction(tx => {
    const row = updateStrategyRow(tx, id, toStrategyColumns(input), Date.now())
    if (row === undefined) return undefined
    deleteTabletRows(tx, id)
    deleteTagRows(tx, id)
    insertTabletRows(tx, toTabletRows(id, input.tablets))
    insertTagRows(tx, toTagRows(id, input.tags))
    return asStored(id, input)
  })

/** True when the strategy existed; child rows go with it via ON DELETE CASCADE. */
export const deleteStrategy = (id: string): boolean =>
  db.transaction(tx => deleteStrategyRow(tx, id) !== undefined)
