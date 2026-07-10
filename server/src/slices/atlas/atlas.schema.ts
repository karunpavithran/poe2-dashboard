import { relations } from 'drizzle-orm'
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Atlas strategies, normalized: the 1:1 `master` object flattens into columns,
 * and the child collections (`tablets`, `tags`) live in their own tables below.
 */
export const atlasStrategies = sqliteTable('atlas_strategies', {
  /**
   * Server-generated UUID on create (text PKs for future merge-ability). Seeded
   * legacy rows kept their hand-written slug ids, so not all values are UUIDs.
   */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sourceUrl: text('source_url'),
  profitPerHour: real('profit_per_hour'),
  masterName: text('master_name').notNull(),
  masterNodes: text('master_nodes').notNull(),
  notes: text('notes'),
  warning: text('warning'),
  /** ms epoch, matching the repo's timestamp convention (cf. `fetchedAt`). */
  createdAt: integer('created_at').notNull(),
  /** Also the display order: the list is served most-recently-updated first. */
  updatedAt: integer('updated_at').notNull(),
})

/**
 * A strategy's tablet slots. Unlike the strategy list (recency-ordered),
 * `sortOrder` here is user-authored content: the editor lets the user arrange
 * the tablet list, so the order is part of the strategy itself. `mods` is the
 * model's one JSON leaf — free-text chip strings with no identity and nothing
 * to query, so normalization deliberately stops here.
 */
export const atlasTablets = sqliteTable(
  'atlas_tablets',
  {
    strategyId: text('strategy_id')
      .notNull()
      .references(() => atlasStrategies.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    type: text('type').notNull(),
    quantity: integer('quantity').notNull(),
    mods: text('mods', { mode: 'json' }).$type<string[]>().notNull(),
    tradeUrl: text('trade_url'),
  },
  table => [primaryKey({ columns: [table.strategyId, table.sortOrder] })],
)

/** A strategy's filter tags — a set by construction, thanks to the composite PK. */
export const atlasTags = sqliteTable(
  'atlas_tags',
  {
    strategyId: text('strategy_id')
      .notNull()
      .references(() => atlasStrategies.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  table => [primaryKey({ columns: [table.strategyId, table.tag] })],
)

export const atlasStrategiesRelations = relations(atlasStrategies, ({ many }) => ({
  tablets: many(atlasTablets),
  tags: many(atlasTags),
}))

export const atlasTabletsRelations = relations(atlasTablets, ({ one }) => ({
  strategy: one(atlasStrategies, {
    fields: [atlasTablets.strategyId],
    references: [atlasStrategies.id],
  }),
}))

export const atlasTagsRelations = relations(atlasTags, ({ one }) => ({
  strategy: one(atlasStrategies, {
    fields: [atlasTags.strategyId],
    references: [atlasStrategies.id],
  }),
}))
