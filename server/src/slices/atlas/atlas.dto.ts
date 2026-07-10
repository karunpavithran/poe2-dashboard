import type { AtlasStrategy, AtlasStrategyInput } from '@poe2-dashboard/shared'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import type { atlasStrategies, atlasTablets, atlasTags } from './atlas.schema.js'

export type AtlasStrategyRow = InferSelectModel<typeof atlasStrategies>
export type NewAtlasStrategyRow = InferInsertModel<typeof atlasStrategies>
export type AtlasTabletRow = InferSelectModel<typeof atlasTablets>
export type NewAtlasTabletRow = InferInsertModel<typeof atlasTablets>
export type AtlasTagRow = InferSelectModel<typeof atlasTags>
export type NewAtlasTagRow = InferInsertModel<typeof atlasTags>

/** The relational read shape: a strategy row with its children loaded. */
export type AtlasStrategyRowWithChildren = AtlasStrategyRow & {
  tablets: AtlasTabletRow[]
  tags: AtlasTagRow[]
}

/**
 * The client-owned parent-column subset: a request body maps onto exactly these
 * plus the child tables. The rest — `id`, `createdAt`, `updatedAt` — is
 * server-managed and supplied by the service at write time.
 */
export type AtlasStrategyColumns = Omit<NewAtlasStrategyRow, 'id' | 'createdAt' | 'updatedAt'>

/** Rows → API shape. Optional contract fields are nullable columns: null → absent. */
export const toAtlasStrategy = (row: AtlasStrategyRowWithChildren): AtlasStrategy => ({
  id: row.id,
  name: row.name,
  sourceUrl: row.sourceUrl ?? undefined,
  profitPerHour: row.profitPerHour ?? undefined,
  master: { name: row.masterName, nodes: row.masterNodes },
  tablets: row.tablets.map(tablet => ({
    type: tablet.type,
    quantity: tablet.quantity,
    mods: tablet.mods,
    tradeUrl: tablet.tradeUrl ?? undefined,
  })),
  notes: row.notes ?? undefined,
  warning: row.warning ?? undefined,
  tags: row.tags.map(row => row.tag),
})

/** Input shape → parent columns. Absent optional fields land as NULL. */
export const toStrategyColumns = (input: AtlasStrategyInput): AtlasStrategyColumns => ({
  name: input.name,
  sourceUrl: input.sourceUrl ?? null,
  profitPerHour: input.profitPerHour ?? null,
  masterName: input.master.name,
  masterNodes: input.master.nodes,
  notes: input.notes ?? null,
  warning: input.warning ?? null,
})

/** Input tablets → child rows; the array index is the user-authored order. */
export const toTabletRows = (
  strategyId: string,
  tablets: AtlasStrategyInput['tablets'],
): NewAtlasTabletRow[] =>
  tablets.map((tablet, index) => ({
    strategyId,
    sortOrder: index,
    type: tablet.type,
    quantity: tablet.quantity,
    mods: tablet.mods,
    tradeUrl: tablet.tradeUrl ?? null,
  }))

/** Input tags → child rows, deduplicated to match the (strategyId, tag) PK's set semantics. */
export const toTagRows = (strategyId: string, tags: string[]): NewAtlasTagRow[] =>
  [...new Set(tags)].map(tag => ({ strategyId, tag }))
