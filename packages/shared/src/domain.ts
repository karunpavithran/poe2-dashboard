import type { z } from 'zod'

import type {
  ArbitrageLegSchema,
  ArbitrageSchema,
  ArbitrageSnapshotSchema,
  AscendancyTrendSchema,
  AtlasStrategySchema,
  CurrencyIconMapSchema,
  CurrencyValueMapSchema,
  ExchangeTypeSchema,
  MainSkillTrendSchema,
  MasterTreeSchema,
  TabletSlotSchema,
} from './schemas.js'

/** A poe.ninja economy exchange category (API `type` value). */
export type ExchangeType = z.infer<typeof ExchangeTypeSchema>

/** A single directed exchange: 1 unit of `from` buys `rate` units of `to`. */
export type RateEdge = {
  from: string
  to: string
  rate: number
  /** Listing/volume count for this direction — liquidity signal. */
  volume: number
  /** Which exchange category's page this edge came from. */
  category: ExchangeType
}

/** One leg of an arbitrage, echoing the edge it was built from. */
export type ArbitrageLeg = z.infer<typeof ArbitrageLegSchema>

/** A profitable triangular cycle: start with 1 unit of cycle[0], end with 1 + profit. */
export type Arbitrage = z.infer<typeof ArbitrageSchema>

/** The Arbitrage widget's display data, persisted across restarts as a startup cache. */
export type ArbitrageSnapshot = z.infer<typeof ArbitrageSnapshotSchema>

export type AscendancyTrend = z.infer<typeof AscendancyTrendSchema>

export type MainSkillTrend = z.infer<typeof MainSkillTrendSchema>

/** One tablet slot in an atlas strategy. */
export type TabletSlot = z.infer<typeof TabletSlotSchema>

/** The atlas master passive allocation for a strategy. */
export type MasterTree = z.infer<typeof MasterTreeSchema>

/** A single atlas farming strategy. */
export type AtlasStrategy = z.infer<typeof AtlasStrategySchema>

/** Maps each currency name to its poecdn.com icon URL. */
export type CurrencyIconMap = z.infer<typeof CurrencyIconMapSchema>

/** Maps each currency name to its value in Divine Orbs. */
export type CurrencyValueMap = z.infer<typeof CurrencyValueMapSchema>

/** Everything computed from one poll of poe.ninja. */
export type Snapshot = {
  league: string
  /** When poe.ninja says the data was generated (ms epoch), if available. */
  sourceTimestamp: number | null
  /** When our server fetched it (ms epoch). */
  fetchedAt: number
  edges: RateEdge[]
}
