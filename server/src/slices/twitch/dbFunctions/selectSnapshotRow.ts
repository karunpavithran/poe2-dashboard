import type { DbTransaction } from '../../../db/client.js'
import type { TwitchSnapshotRowWithStreams } from '../twitch.dto.js'

/** The game's snapshot with its stream rows, or undefined before the first fetch. */
export const selectSnapshotRow = (
  tx: DbTransaction,
  game: string,
): TwitchSnapshotRowWithStreams | undefined =>
  tx.query.twitchSnapshots
    .findFirst({
      where: (snapshots, { eq }) => eq(snapshots.game, game),
      with: { streams: true },
    })
    .sync()
