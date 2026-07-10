import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import type { AtlasStrategyRow } from '../atlas.dto.js'
import { atlasStrategies } from '../atlas.schema.js'

/** Returns the deleted row (RETURNING), or undefined when the id doesn't exist. */
export const deleteStrategyRow = (tx: DbTransaction, id: string): AtlasStrategyRow | undefined =>
  tx.delete(atlasStrategies).where(eq(atlasStrategies.id, id)).returning().get()
