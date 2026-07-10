import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import { economyCurrencies } from '../economy.schema.js'

export const deleteCurrencyRows = (tx: DbTransaction, league: string): void => {
  tx.delete(economyCurrencies).where(eq(economyCurrencies.league, league)).run()
}
