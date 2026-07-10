import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import type { AtlasStrategyColumns, AtlasStrategyRow } from '../atlas.dto.js'
import { atlasStrategies } from '../atlas.schema.js'

/**
 * Full replace of the client-owned columns (PUT semantics); `createdAt` is left
 * untouched. Returns the updated row (RETURNING), or undefined when the id
 * doesn't exist.
 */
export const updateStrategyRow = (
  tx: DbTransaction,
  id: string,
  columns: AtlasStrategyColumns,
  updatedAt: number,
): AtlasStrategyRow | undefined =>
  tx
    .update(atlasStrategies)
    .set({ ...columns, updatedAt })
    .where(eq(atlasStrategies.id, id))
    .returning()
    .get()
