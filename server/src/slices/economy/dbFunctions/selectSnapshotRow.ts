import type { DbTransaction } from '../../../db/client.js'
import type { EconomySnapshotRowWithChildren } from '../economy.dto.js'

/** The league's snapshot with its edge and currency rows, or undefined before the first poll. */
export const selectSnapshotRow = (
  tx: DbTransaction,
  league: string,
): EconomySnapshotRowWithChildren | undefined =>
  tx.query.economySnapshots
    .findFirst({
      where: (snapshots, { eq }) => eq(snapshots.league, league),
      with: { edges: true, currencies: true },
    })
    .sync()
