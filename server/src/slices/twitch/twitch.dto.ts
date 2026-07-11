import type { TwitchStream } from '@poe2-dashboard/shared'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import type { twitchSnapshots, twitchStreamRows } from './twitch.schema.js'

export type TwitchSnapshotRow = InferSelectModel<typeof twitchSnapshots>
export type NewTwitchSnapshotRow = InferInsertModel<typeof twitchSnapshots>
export type TwitchStreamRow = InferSelectModel<typeof twitchStreamRows>
export type NewTwitchStreamRow = InferInsertModel<typeof twitchStreamRows>

/** The persisted shape the fetcher saves and restores. */
export type TwitchSnapshot = {
  fetchedAt: number
  streams: TwitchStream[]
}

/** The relational read shape: a snapshot row with its stream rows loaded. */
export type TwitchSnapshotRowWithStreams = TwitchSnapshotRow & {
  streams: TwitchStreamRow[]
}

/** Rows → snapshot. Re-sorts by viewers since row order isn't a stored fact. */
export const toTwitchSnapshot = (row: TwitchSnapshotRowWithStreams): TwitchSnapshot => ({
  fetchedAt: row.fetchedAt,
  streams: row.streams
    .map(({ userId, userName, title, viewerCount, startedAt, tags }) => ({
      userId,
      userName,
      title,
      viewerCount,
      startedAt,
      tags,
    }))
    .sort((a, b) => b.viewerCount - a.viewerCount),
})

export const toSnapshotRow = (game: string, snapshot: TwitchSnapshot): NewTwitchSnapshotRow => ({
  game,
  fetchedAt: snapshot.fetchedAt,
})

export const toStreamRows = (game: string, snapshot: TwitchSnapshot): NewTwitchStreamRow[] =>
  snapshot.streams.map(stream => ({ game, ...stream }))
