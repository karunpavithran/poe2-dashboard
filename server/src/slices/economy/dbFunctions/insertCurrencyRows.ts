import type { DbTransaction } from '../../../db/client.js'
import type { NewEconomyCurrencyRow } from '../economy.dto.js'
import { economyCurrencies } from '../economy.schema.js'

/** ~650 currencies at 4 bind params each — chunked for the same reason as edges. */
const CHUNK_SIZE = 1000

export const insertCurrencyRows = (tx: DbTransaction, rows: NewEconomyCurrencyRow[]): void => {
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    tx.insert(economyCurrencies)
      .values(rows.slice(start, start + CHUNK_SIZE))
      .run()
  }
}
