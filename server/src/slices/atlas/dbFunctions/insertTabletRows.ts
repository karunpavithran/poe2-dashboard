import type { DbTransaction } from '../../../db/client.js'
import type { NewAtlasTabletRow } from '../atlas.dto.js'
import { atlasTablets } from '../atlas.schema.js'

export const insertTabletRows = (tx: DbTransaction, rows: NewAtlasTabletRow[]): void => {
  if (rows.length === 0) return
  tx.insert(atlasTablets).values(rows).run()
}
