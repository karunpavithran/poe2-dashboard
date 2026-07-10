import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import { atlasTags } from '../atlas.schema.js'

export const deleteTagRows = (tx: DbTransaction, strategyId: string): void => {
  tx.delete(atlasTags).where(eq(atlasTags.strategyId, strategyId)).run()
}
