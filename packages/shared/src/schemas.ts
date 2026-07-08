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

// --- Economy (GET /api/arbitrages) ---

// Building blocks the exported schemas compose from, so a future change to the
// cycle arity, the icon-map shape, or the fields shared by the response and the
// persisted snapshot fans out from a single spot. `triple` and
// `EconomyPayloadSchema` stay module-private; CurrencyIconMapSchema is exported
// so domain.ts can derive the CurrencyIconMap type from it.

/** Exactly three of `schema` — the fixed arity of a triangular arbitrage (3 currencies, 3 legs). */
const triple = <T extends z.ZodTypeAny>(schema: T) => z.tuple([schema, schema, schema])

/** Currency name → poecdn.com icon URL. */
export const CurrencyIconMapSchema = z.record(z.string(), z.string())

/** Currency name → its mid value in Divine Orbs (Divine Orb itself maps to 1). */
export const CurrencyValueMapSchema = z.record(z.string(), z.number())

/**
 * The three anchor hubs every exchange market prices against. The keys are stable
 * (poe.ninja's `core.primary`/`secondary` plus chaos), so the client can label the
 * comparison rows without knowing each hub's display name.
 */
export const HUB_KEYS = ['divine', 'exalted', 'chaos'] as const

/**
 * For one currency, the best Divine-denominated rate against each hub. `null`
 * means no honest route exists to/from that hub (we never invert observed rates,
 * so a direction with no observed market stays absent). Populated per-direction:
 * in `bestBuy` a value is Divine *paid* to acquire 1 unit (lower is better); in
 * `bestSell` it's Divine *received* for 1 unit (higher is better).
 */
export const HubPricesSchema = z.object({
  divine: z.number().nullable(),
  exalted: z.number().nullable(),
  chaos: z.number().nullable(),
})

/** Currency name → its per-hub best rates (see HubPricesSchema). */
export const BestExchangeMapSchema = z.record(z.string(), HubPricesSchema)

/**
 * The three anchor hubs' display names, keyed by their stable hub key — so the
 * client can label the comparison rows and resolve each hub's icon without
 * hardcoding currency names. The default matches PoE2's fixed anchors and only
 * applies to caches written before this field existed.
 */
export const HubNamesSchema = z
  .object({ divine: z.string(), exalted: z.string(), chaos: z.string() })
  .default({ divine: 'Divine Orb', exalted: 'Exalted Orb', chaos: 'Chaos Orb' })

/**
 * A single directed exchange edge: 1 unit of `from` buys `rate` units of `to`.
 * This is the canonical wire shape for the economy — the API ships an array of
 * these and the client rebuilds the rate graph (and from it the arbitrage cycles
 * and per-hub buy/sell rates) rather than the server precomputing those views.
 */
export const RateEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  rate: z.number(),
  /** Listing/volume count for this direction — liquidity signal. */
  volume: z.number(),
  /** Which exchange category's page this rate came from. */
  category: ExchangeTypeSchema,
})

/** One leg of an arbitrage is exactly one observed edge. */
export const ArbitrageLegSchema = RateEdgeSchema

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

/**
 * Fields shared by the live API response and the persisted snapshot — the
 * *minimal economy source*. We ship the observed rate `edges` plus the
 * per-currency value/icon maps and hub names; the client rebuilds the graph and
 * derives arbitrage cycles, per-hub buy/sell rates, and currency→category from it
 * (buildGraph / findTriangularArbitrages / computeBestExchange /
 * computeCurrencyCategories). Keeping derivation client-side means a new view
 * costs no server/schema change and the wire stays a normalized edge list.
 */
const EconomyPayloadSchema = z.object({
  league: z.string(),
  /** Every observed directed exchange edge — the graph the client derives from. */
  edges: z.array(RateEdgeSchema).default([]),
  /**
   * Currency name → value in Divine Orbs (Divine Orb itself = 1), so the client
   * can normalize rates and total a trade's net across currencies in one unit.
   */
  currencyValues: CurrencyValueMapSchema.default({}),
  /** Currency name → poecdn.com icon URL. */
  currencyIcons: CurrencyIconMapSchema.default({}),
  /** The three anchor hubs' display names, for labelling the buy/sell comparison. */
  hubs: HubNamesSchema,
})

// --- Arbitrage filter state (client URL query params) ---

/**
 * Filter defaults — the baseline the toolbar compares against to show "active",
 * and what the URL parser falls back to. Omitting a param from the URL restores
 * its default, so the default view carries no query string at all.
 */
export const DEFAULT_MIN_PROFIT = 250
export const DEFAULT_MIN_VOLUME = 10

/**
 * The Arbitrage widget's filter state as it lives in the URL query string, so a
 * filtered view is shareable and bookmarkable. Input is the raw string params
 * (Object.fromEntries(URLSearchParams)); output is the normalized state the UI
 * consumes. Everything is lenient so a malformed or stale link degrades to a
 * sensible view instead of throwing:
 *   - minProfit / minVolume: coerced from string; a missing, non-numeric, or
 *     negative value falls back to its default.
 *   - categories: comma-separated ExchangeType list, deduped, with unknown
 *     tokens dropped. An *absent* param means "all categories" (no filter); a *present*
 *     one is taken literally, so an empty string round-trips the "none selected"
 *     state (an empty table) rather than snapping back to all.
 */
export const ArbitrageFilterSchema = z.object({
  minProfit: z.coerce.number().min(0).catch(DEFAULT_MIN_PROFIT),
  minVolume: z.coerce.number().min(0).catch(DEFAULT_MIN_VOLUME),
  categories: z
    .string()
    .optional()
    .transform(value => {
      if (value === undefined) return [...EXCHANGE_TYPES]
      const selected = value
        .split(',')
        .map(part => ExchangeTypeSchema.safeParse(part.trim()))
        .flatMap(result => (result.success ? [result.data] : []))
      return [...new Set(selected)]
    }),
})

/** Normalized arbitrage filter state parsed from the URL query. */
export type ArbitrageFilters = z.infer<typeof ArbitrageFilterSchema>

/**
 * Serialize filter state back into URL query params — the inverse of parsing
 * with ArbitrageFilterSchema. Anything at its default is omitted so shared links
 * stay short; the empty-categories case still emits `categories=` to distinguish
 * "none selected" from the omitted "all".
 */
export const arbitrageFiltersToParams = (filters: ArbitrageFilters): Record<string, string> => {
  const params: Record<string, string> = {}
  if (filters.minProfit !== DEFAULT_MIN_PROFIT) params.minProfit = String(filters.minProfit)
  if (filters.minVolume !== DEFAULT_MIN_VOLUME) params.minVolume = String(filters.minVolume)
  if (filters.categories.length !== EXCHANGE_TYPES.length) {
    params.categories = filters.categories.join(',')
  }
  return params
}

export const EconomyResponseSchema = EconomyPayloadSchema.extend({
  /** ms epoch of the snapshot these edges were computed from. */
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
 * the Exchanges widget can render the last good data immediately instead of
 * nothing while the first poll (which takes minutes) runs. Stores the same
 * minimal source the API serves — edges + value/icon maps + hubs — since the
 * client derives everything else.
 */
export const EconomySnapshotSchema = EconomyPayloadSchema.extend({
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
