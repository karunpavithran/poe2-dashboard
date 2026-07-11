import { db } from '../../db/client.js'
import { deleteStreamRows } from './dbFunctions/deleteStreamRows.js'
import { insertStreamRows } from './dbFunctions/insertStreamRows.js'
import { selectSnapshotRow } from './dbFunctions/selectSnapshotRow.js'
import { upsertSnapshotRow } from './dbFunctions/upsertSnapshotRow.js'
import type { TwitchSnapshot } from './twitch.dto.js'
import { toSnapshotRow, toStreamRows, toTwitchSnapshot } from './twitch.dto.js'

// The dashboard tracks exactly one game; the column exists so the schema keys
// like every other snapshot table (economy keys by league), not for multi-game.
const GAME = 'poe2'

/**
 * Persists a fetch's snapshot, replacing the previous one — no history.
 * Stream rows are replaced wholesale (delete + reinsert) in the same transaction.
 */
export const saveTwitchSnapshot = (snapshot: TwitchSnapshot): void => {
  db.transaction(tx => {
    upsertSnapshotRow(tx, toSnapshotRow(GAME, snapshot))
    deleteStreamRows(tx, GAME)
    insertStreamRows(tx, toStreamRows(GAME, snapshot))
  })
}

/** The persisted snapshot, or undefined before the first-ever fetch. */
export const loadTwitchSnapshot = (): TwitchSnapshot | undefined =>
  db.transaction(tx => {
    const row = selectSnapshotRow(tx, GAME)
    return row === undefined ? undefined : toTwitchSnapshot(row)
  })
