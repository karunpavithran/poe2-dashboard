import type { DbTransaction } from '../../../db/client.js'
import type { NewTwitchSnapshotRow, TwitchSnapshotRow } from '../twitch.dto.js'
import { twitchSnapshots } from '../twitch.schema.js'

/** One row per game: insert or replace the game's snapshot. Returns it as stored. */
export const upsertSnapshotRow = (
  tx: DbTransaction,
  { game, ...rest }: NewTwitchSnapshotRow,
): TwitchSnapshotRow =>
  tx
    .insert(twitchSnapshots)
    .values({ game, ...rest })
    .onConflictDoUpdate({ target: twitchSnapshots.game, set: rest })
    .returning()
    .get()
