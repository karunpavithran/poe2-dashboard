import type { DbTransaction } from '../../../db/client.js'
import type { EconomySnapshotRow, NewEconomySnapshotRow } from '../economy.dto.js'
import { economySnapshots } from '../economy.schema.js'

/** One row per league: insert or replace the league's snapshot. Returns it as stored. */
export const upsertSnapshotRow = (
  tx: DbTransaction,
  { league, ...rest }: NewEconomySnapshotRow,
): EconomySnapshotRow =>
  tx
    .insert(economySnapshots)
    .values({ league, ...rest })
    .onConflictDoUpdate({ target: economySnapshots.league, set: rest })
    .returning()
    .get()
