import type { EconomySnapshot } from '@poe2-dashboard/shared'

import { db } from '../../db/client.js'
import { deleteCurrencyRows } from './dbFunctions/deleteCurrencyRows.js'
import { deleteEdgeRows } from './dbFunctions/deleteEdgeRows.js'
import { insertCurrencyRows } from './dbFunctions/insertCurrencyRows.js'
import { insertEdgeRows } from './dbFunctions/insertEdgeRows.js'
import { selectSnapshotRow } from './dbFunctions/selectSnapshotRow.js'
import { upsertSnapshotRow } from './dbFunctions/upsertSnapshotRow.js'
import { toCurrencyRows, toEconomySnapshot, toEdgeRows, toSnapshotRow } from './economy.dto.js'

/**
 * Persists a poll's snapshot, replacing the league's previous one — no history.
 * Children are replaced wholesale (delete + reinsert) in the same transaction.
 */
export const saveSnapshot = (snapshot: EconomySnapshot): void => {
  db.transaction(tx => {
    upsertSnapshotRow(tx, toSnapshotRow(snapshot))
    deleteEdgeRows(tx, snapshot.league)
    insertEdgeRows(tx, toEdgeRows(snapshot))
    deleteCurrencyRows(tx, snapshot.league)
    insertCurrencyRows(tx, toCurrencyRows(snapshot))
  })
}

/** The league's persisted snapshot, or undefined before the first poll. */
export const loadSnapshot = (league: string): EconomySnapshot | undefined =>
  db.transaction(tx => {
    const row = selectSnapshotRow(tx, league)
    return row === undefined ? undefined : toEconomySnapshot(row)
  })
