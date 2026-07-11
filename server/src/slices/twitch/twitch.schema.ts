import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * The latest fetched Twitch stream list — a restart cache, deliberately NOT
 * history: each fetch replaces the game's row and its stream rows. Exists so a
 * server restart serves the last snapshot instead of re-hitting Twitch and the
 * Claude tagging call.
 */
export const twitchSnapshots = sqliteTable('twitch_snapshots', {
  game: text('game').primaryKey(),
  /** ms epoch of the fetch. */
  fetchedAt: integer('fetched_at').notNull(),
})

/**
 * A snapshot's stream rows, replaced wholesale on each fetch. No explicit PK;
 * SQLite's rowid is enough for machine-regenerable bulk rows.
 */
export const twitchStreamRows = sqliteTable('twitch_streams', {
  game: text('game')
    .notNull()
    .references(() => twitchSnapshots.game, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  title: text('title').notNull(),
  viewerCount: integer('viewer_count').notNull(),
  /** ISO timestamp from Twitch, stored as-is. */
  startedAt: text('started_at').notNull(),
  /** Claude-generated build/content tags — opaque display chips, never queried individually. */
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
})

export const twitchSnapshotsRelations = relations(twitchSnapshots, ({ many }) => ({
  streams: many(twitchStreamRows),
}))

export const twitchStreamRowsRelations = relations(twitchStreamRows, ({ one }) => ({
  snapshot: one(twitchSnapshots, {
    fields: [twitchStreamRows.game],
    references: [twitchSnapshots.game],
  }),
}))
