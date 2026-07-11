import type { DbTransaction } from '../../../db/client.js'
import type { NewTwitchStreamRow } from '../twitch.dto.js'
import { twitchStreamRows } from '../twitch.schema.js'

export const insertStreamRows = (tx: DbTransaction, rows: NewTwitchStreamRow[]): void => {
  if (rows.length === 0) return
  tx.insert(twitchStreamRows).values(rows).run()
}
