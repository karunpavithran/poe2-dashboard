import type { DbTransaction } from '../../../db/client.js'
import type { NewAtlasTagRow } from '../atlas.dto.js'
import { atlasTags } from '../atlas.schema.js'

export const insertTagRows = (tx: DbTransaction, rows: NewAtlasTagRow[]): void => {
  if (rows.length === 0) return
  tx.insert(atlasTags).values(rows).run()
}
