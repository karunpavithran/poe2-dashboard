import type { DbTransaction } from '../../../db/client.js'
import type { NewEconomyEdgeRow } from '../economy.dto.js'
import { economyEdges } from '../economy.schema.js'

/**
 * A snapshot carries a couple thousand edges at 6 bind params each; chunking
 * keeps every bulk INSERT far below SQLite's 32k bind-variable cap.
 */
const CHUNK_SIZE = 1000

export const insertEdgeRows = (tx: DbTransaction, rows: NewEconomyEdgeRow[]): void => {
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    tx.insert(economyEdges)
      .values(rows.slice(start, start + CHUNK_SIZE))
      .run()
  }
}
