import type { ExchangeType } from '@poe2-dashboard/shared'
import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * The latest snapshot per league — a persistence cache, deliberately NOT
 * history: each poll replaces the league's row and children, and trend-over-
 * time data is poe.ninja's job, not ours. The three anchor hubs are a fixed
 * 3-slot object, so they flatten into columns.
 */
export const economySnapshots = sqliteTable('economy_snapshots', {
  league: text('league').primaryKey(),
  /** ms epoch of the poll. */
  fetchedAt: integer('fetched_at').notNull(),
  hubDivine: text('hub_divine').notNull(),
  hubExalted: text('hub_exalted').notNull(),
  hubChaos: text('hub_chaos').notNull(),
})

/**
 * A snapshot's raw observed edge list, stored faithfully: a currency pair can
 * legitimately appear more than once (hub↔hub edges show up on several category
 * pages), so there's deliberately no uniqueness on (league, from, to) — dedup
 * stays the client's job (buildGraph), same as on the wire. No explicit PK
 * either; SQLite's rowid is enough for machine-regenerable bulk rows.
 */
export const economyEdges = sqliteTable(
  'economy_edges',
  {
    league: text('league')
      .notNull()
      .references(() => economySnapshots.league, { onDelete: 'cascade' }),
    from: text('from').notNull(),
    to: text('to').notNull(),
    rate: real('rate').notNull(),
    /** Listing/volume count for this direction — liquidity signal. */
    volume: real('volume').notNull(),
    /** Which exchange category's page this rate came from. */
    category: text('category').$type<ExchangeType>().notNull(),
  },
  table => [index('economy_edges_league_idx').on(table.league)],
)

/**
 * Per-currency metadata for a snapshot — the wire's `currencyValues` and
 * `currencyIcons` maps merged into one row per currency. A currency can appear
 * in just one of the maps, hence both payload columns are nullable; the DTO
 * rebuilds each map from the non-null values.
 */
export const economyCurrencies = sqliteTable(
  'economy_currencies',
  {
    league: text('league')
      .notNull()
      .references(() => economySnapshots.league, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Value in Divine Orbs (Divine Orb itself = 1). */
    value: real('value'),
    /** poecdn.com icon URL. */
    icon: text('icon'),
  },
  table => [primaryKey({ columns: [table.league, table.name] })],
)

export const economySnapshotsRelations = relations(economySnapshots, ({ many }) => ({
  edges: many(economyEdges),
  currencies: many(economyCurrencies),
}))

export const economyEdgesRelations = relations(economyEdges, ({ one }) => ({
  snapshot: one(economySnapshots, {
    fields: [economyEdges.league],
    references: [economySnapshots.league],
  }),
}))

export const economyCurrenciesRelations = relations(economyCurrencies, ({ one }) => ({
  snapshot: one(economySnapshots, {
    fields: [economyCurrencies.league],
    references: [economySnapshots.league],
  }),
}))
