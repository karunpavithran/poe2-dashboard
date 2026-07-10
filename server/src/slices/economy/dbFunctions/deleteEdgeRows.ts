import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import { economyEdges } from '../economy.schema.js'

export const deleteEdgeRows = (tx: DbTransaction, league: string): void => {
  tx.delete(economyEdges).where(eq(economyEdges.league, league)).run()
}
