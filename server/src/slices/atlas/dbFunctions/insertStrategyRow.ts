import type { DbTransaction } from '../../../db/client.js'
import type { AtlasStrategyRow, NewAtlasStrategyRow } from '../atlas.dto.js'
import { atlasStrategies } from '../atlas.schema.js'

/** Returns the row as stored (RETURNING). */
export const insertStrategyRow = (tx: DbTransaction, row: NewAtlasStrategyRow): AtlasStrategyRow =>
  tx.insert(atlasStrategies).values(row).returning().get()
