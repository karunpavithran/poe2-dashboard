import { eq } from 'drizzle-orm'

import type { DbTransaction } from '../../../db/client.js'
import { twitchStreamRows } from '../twitch.schema.js'

export const deleteStreamRows = (tx: DbTransaction, game: string): void => {
  tx.delete(twitchStreamRows).where(eq(twitchStreamRows.game, game)).run()
}
