import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import { atlasTablets } from '../atlas.schema.js'

export const deleteTabletRows = (tx: DbTransaction, strategyId: string): void => {
  tx.delete(atlasTablets).where(eq(atlasTablets.strategyId, strategyId)).run()
}
