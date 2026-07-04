import { z } from 'zod'

// Zod is the single source of truth: the types in domain.ts / api.ts / twitch.ts
// are derived from these schemas via z.infer. Field semantics are documented here.
// Schemas are grouped by feature; within each group, building-block schemas come
// before the request/response schemas that compose them.

// --- Exchange categories ---

// poe.ninja's economy exchange API is the same endpoint shape for every
// tradeable category, selected by a `type` query param (the API value — no
// space, e.g. `UncutGems`). We poll the categories that actually have a market
// in PoE2: all of them anchor against the same core hub (divine/exalted/chaos),
// so their edges merge into one graph and arbitrage routes across categories.
// The API `type` is poe.ninja's internal grouping key and can diverge from the
// displayed name (e.g. `Ritual` lists Omens, `Breach` lists Catalysts) — see
// EXCHANGE_CATEGORY_LABELS. Types that are still empty (Uniques, Tablets, …) are
// intentionally omitted until they have a market.
export const EXCHANGE_TYPES = [
  'Currency',
  'Fragments',
  'Abyss',
  'Runes',
  'LineageSupportGems',
  'Essences',
  'UncutGems',
  'SoulCores',
  'Idols',
  'Ritual',
  'Expedition',
  'Delirium',
  'Breach',
  'Verisium',
] as const

export const ExchangeTypeSchema = z.enum(EXCHANGE_TYPES)

/** Human-readable label per category (the API value is spaceless). */
export const EXCHANGE_CATEGORY_LABELS: Record<z.infer<typeof ExchangeTypeSchema>, string> = {
  Currency: 'Currency',
  Fragments: 'Fragments',
  Abyss: 'Abyss',
  Runes: 'Runes',
  LineageSupportGems: 'Lineage Gems',
  Essences: 'Essences',
  UncutGems: 'Uncut Gems',
  SoulCores: 'Soul Cores',
  Idols: 'Idols',
  Ritual: 'Omens',
  Expedition: 'Expedition',
  Delirium: 'Delirium',
  Breach: 'Catalyst',
  Verisium: 'Verisium',
}

// --- Arbitrage (GET /api/arbitrages) ---

// Building blocks the exported schemas compose from, so a future change to the
// cycle arity, the icon-map shape, or the fields shared by every arbitrage
// payload fans out from a single spot. `triple` and `ArbitragePayloadSchema`
// stay module-private; CurrencyIconMapSchema is exported so domain.ts can derive
// the CurrencyIconMap type from it.

/** Exactly three of `schema` — the fixed arity of a triangular arbitrage (3 currencies, 3 legs). */
const triple = <T extends z.ZodTypeAny>(schema: T) => z.tuple([schema, schema, schema])

/** Currency name → poecdn.com icon URL. */
export const CurrencyIconMapSchema = z.record(z.string(), z.string())

/** Currency name → its mid value in Divine Orbs (Divine Orb itself maps to 1). */
export const CurrencyValueMapSchema = z.record(z.string(), z.number())

/** One leg of an arbitrage, echoing the edge it was built from. */
export const ArbitrageLegSchema = z.object({
  from: z.string(),
  to: z.string(),
  rate: z.number(),
  /** Listing/volume count for this direction — liquidity signal. */
  volume: z.number(),
  /** Which exchange category's page this rate came from. */
  category: ExchangeTypeSchema,
})

/** A profitable triangular cycle: start with 1 unit of cycle[0], end with 1 + profit. */
export const ArbitrageSchema = z.object({
  cycle: triple(z.string()).describe(
    'The three currencies in trade order, canonicalized to start at the lexicographically smallest.',
  ),
  /** Round-trip multiplier, e.g. 1.05 means +5%. */
  multiplier: z.number(),
  /** (multiplier - 1) * 100 */
  profitPct: z.number(),
  legs: triple(ArbitrageLegSchema),
  /** Minimum volume across the three legs — the cycle's effective liquidity. */
  minVolume: z.number(),
})

/** Fields shared by every arbitrage payload — the live API response and the persisted snapshot. */
const ArbitragePayloadSchema = z.object({
  league: z.string(),
  arbitrages: z.array(ArbitrageSchema),
  currencyIcons: CurrencyIconMapSchema,
  /**
   * Currency name → value in Divine Orbs, so the client can total a trade's net
   * across currencies in one unit. Defaults to empty for older cached snapshots
   * written before this field existed.
   */
  currencyValues: CurrencyValueMapSchema.default({}),
})

export const ArbitragesParamsSchema = z.object({
  /** Minimum profit percent, e.g. 2 means only cycles paying >= 2%. */
  minProfit: z.coerce.number().optional(),
  /** Minimum per-leg volume. */
  minVolume: z.coerce.number().optional(),
  /**
   * Comma-separated exchange categories to include (e.g. "Currency,Runes").
   * A cycle is kept only if every leg comes from a selected category. Omitted
   * means all categories.
   */
  categories: z.string().optional(),
})

export const ArbitragesResponseSchema = ArbitragePayloadSchema.extend({
  /** ms epoch of the snapshot the arbitrages were computed from. */
  updatedAt: z.number().nullable(),
  /** Age of that snapshot in ms at response time, null before first successful poll. */
  dataAgeMs: z.number().nullable(),
  /**
   * True while an economy poll is in flight (the scheduled hourly poll or an
   * on-demand refresh via POST /api/arbitrages/refresh). Lets the client show a
   * "refreshing…" state for the whole multi-minute poll rather than the brief
   * flicker of the cheap cached-snapshot read.
   */
  isRefreshing: z.boolean(),
  /** Set if the most recent poll failed (last good snapshot is still served). */
  lastError: z.string().nullable(),
})

/**
 * Written to disk after each successful economy poll and reloaded on startup so
 * the Arbitrage widget can render the last good data immediately instead of
 * nothing while the first poll (which takes minutes) runs. Only the data the
 * widget displays is cached — build trends refetch quickly and aren't persisted.
 */
export const ArbitrageSnapshotSchema = ArbitragePayloadSchema.extend({
  /** ms epoch of the poll this was computed from; drives the UI's data-age badge. */
  fetchedAt: z.number(),
})

// --- Twitch streams (GET /api/streams) ---

export const TwitchStreamSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  title: z.string(),
  viewerCount: z.number(),
  startedAt: z.string(),
  tags: z.array(z.string()).default([]),
})

// Also the shared base for BuildTrendsResponseSchema below, which embeds the same
// streams payload (`streams` + `fetchedAt`/`lastError`) alongside its trend data.
export const StreamsResponseSchema = z.object({
  streams: z.array(TwitchStreamSchema),
  fetchedAt: z.number().nullable(),
  lastError: z.string().nullable(),
})

// --- Build trends (GET /api/build-trends) ---

export const AscendancyTrendSchema = z.object({
  name: z.string(),
  pct: z.number(),
  trend: z.union([z.literal(1), z.literal(0), z.literal(-1)]),
})

export const MainSkillTrendSchema = z.object({
  name: z.string(),
  /** Share of builds featuring this skill, as a percentage (0–100). */
  pct: z.number(),
  /** Raw character count from poe.ninja, for sorting/tooltips. */
  count: z.number(),
  /** Trend vs the prior snapshot: 1 rising, 0 flat, -1 falling. */
  trend: z.union([z.literal(1), z.literal(0), z.literal(-1)]),
})

// Extends StreamsResponseSchema, so the embedded streams payload (`streams`,
// `fetchedAt`, `lastError`) stays in lockstep with GET /api/streams.
export const BuildTrendsResponseSchema = StreamsResponseSchema.extend({
  /** Top ascendancy classes by character share, with trend direction. */
  ascendancies: z.array(AscendancyTrendSchema),
  /** Top main skills by build share, with week-over-week trend (empty if unavailable). */
  mainSkills: z.array(MainSkillTrendSchema),
  /** Set if the poe.ninja build-data fetch failed (distinct from the streams `lastError`). */
  ninjaError: z.string().nullable(),
})

// --- Atlas strategies (GET/PUT /api/atlas) ---

/** One tablet slot in a strategy: a tablet type, how many to slot, and the mods to look for. */
export const TabletSlotSchema = z.object({
  /** Tablet type/family, e.g. "Deli", "Irradiating", "Breach". */
  type: z.string(),
  /** How many of this tablet to slot. */
  quantity: z.number().int().positive().default(1),
  /** Desired modifiers to roll or look for on the tablet. */
  mods: z.array(z.string()).default([]),
  /** Optional path of exile trade link prefilled with the search for this tablet. */
  tradeUrl: z.string().optional(),
})

/** The atlas master passive allocation for a strategy. */
export const MasterTreeSchema = z.object({
  /** Master name, e.g. "Dory" or "Jado". */
  name: z.string(),
  /** Allocated node shorthand, free text for now, e.g. "1-2, 2-2, 3-2, 4-3". */
  nodes: z.string().default(''),
})

/** A single atlas farming strategy. */
export const AtlasStrategySchema = z.object({
  /** Stable id; client-generated via crypto.randomUUID for new strategies. */
  id: z.string(),
  name: z.string(),
  /** Optional guide/video URL. */
  sourceUrl: z.string().optional(),
  /** Expected profit in divines per hour, if known. */
  profitPerHour: z.number().optional(),
  master: MasterTreeSchema,
  tablets: z.array(TabletSlotSchema).default([]),
  /** Free-form notes (rolling tips, mechanics). */
  notes: z.string().optional(),
  /** Warning callout, e.g. "Currently bugged — tablets sometimes cannot be used". */
  warning: z.string().optional(),
  /** Tags for filtering, e.g. "citadel", "breach", "deli". */
  tags: z.array(z.string()).default([]),
})

/** Response body of GET /api/atlas and request body of PUT /api/atlas. */
export const AtlasResponseSchema = z.object({
  strategies: z.array(AtlasStrategySchema),
})
