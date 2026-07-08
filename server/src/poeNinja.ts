import type {
  ExchangeType,
  HubNames,
  MainSkillTrend,
  RateEdge,
  Snapshot,
} from '@poe2-dashboard/shared'
import { EXCHANGE_TYPES } from '@poe2-dashboard/shared'
import { pipeline, withRateLimit, withRetry } from 'fetch-extras'
import { z } from 'zod'

import type { SearchResult } from './protobuf.js'
import { decodeDictionaryNames, decodeSearchResult } from './protobuf.js'

const BASE_URL = 'https://poe.ninja/poe2/api/economy/exchange/current'

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'poe2-dashboard/0.1 (personal arbitrage tool)',
}

// --- poe.ninja request throttling + 429 backoff ---
//
// One economy poll now fans out to hundreds of requests (an overview + every
// item's details, across all categories), and a tsx hot-reload restarts the
// server and re-polls immediately — both reliably trip poe.ninja's rate limit.
// Every poe.ninja call goes through `ninjaFetch`, composed from fetch-extras:
//   - withRateLimit caps our steady-state rate so we never burst (shared
//     sliding window across all concurrent calls).
//   - withRetry retries 429/5xx honoring Retry-After, with exponential backoff
//     + jitter, so a rate-limited poll recovers instead of failing.
// Order matters: rate-limit is inner, retry is outer, so each retry attempt is
// itself rate-limited. The base is a late-bound wrapper around the global fetch
// so tests can stub `globalThis.fetch`.
// Wrap the base fetch to surface the prime suspect for slow polls: poe.ninja
// rate-limiting us. A 429 means withRetry is about to back off (honoring
// Retry-After), so a poll full of these is what stretches a fetch into minutes.
const ninjaFetch = pipeline(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, init)
    if (res.status === 429) {
      const url = typeof input === 'string' ? input : input.toString()
      console.warn(
        `[poeNinja] 429 rate-limited (retry-after: ${res.headers.get('retry-after') ?? 'n/a'}s) for ${url}`,
      )
    }
    return res
  },
  withRateLimit({ requestsPerInterval: 3, interval: 1000 }),
  withRetry({ retries: 4 }),
)

/**
 * Wire-format schemas for poe.ninja's PoE2 currency exchange API, verified
 * against a real payload captured June 12, 2026 (see fixtures/overview.json).
 * These schemas are the source of truth — the PoeNinja* types below are derived
 * via z.infer. Optional fields are genuinely omitted by poe.ninja for some
 * currencies, and the edge/icon builders already tolerate their absence.
 *
 *   GET {BASE_URL}/overview?league=<league>&type=Currency
 *
 * Semantics:
 * - `core.primary` names the currency everything is valued in ("divine").
 * - `lines[].primaryValue` = how many primary-currency units 1 unit of the
 *   line's currency is worth (a mid rate — no bid/ask spread in this payload).
 * - `lines[].maxVolumeCurrency`/`maxVolumeRate` = the line's highest-volume
 *   market and its observed rate: 1 maxVolumeCurrency buys maxVolumeRate units
 *   of the line's currency.
 * - `lines[].volumePrimaryValue` = trade volume expressed in primary units.
 * - No timestamp in the payload; freshness is tracked by our fetch time.
 */
const PoeNinjaItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional(),
  category: z.string().optional(),
  detailsId: z.string().optional(),
})

const PoeNinjaCoreSchema = z.object({
  items: z.array(PoeNinjaItemSchema),
  /** Units of <id> per 1 primary unit, e.g. { exalted: 128.4, chaos: 10.10 }. */
  rates: z.record(z.string(), z.number()),
  primary: z.string(),
  secondary: z.string(),
})

const PoeNinjaLineSchema = z.object({
  id: z.string(),
  primaryValue: z.number(),
  volumePrimaryValue: z.number().optional(),
  maxVolumeCurrency: z.string().optional(),
  maxVolumeRate: z.number().optional(),
})

const PoeNinjaOverviewResponseSchema = z.object({
  core: PoeNinjaCoreSchema,
  lines: z.array(PoeNinjaLineSchema),
  items: z.array(PoeNinjaItemSchema),
})

/**
 * Per-currency pair data:
 *   GET {BASE_URL}/details?league=<league>&type=Currency&id=<detailsId>
 *
 * `pairs[].rate` = units of the pair currency 1 unit of `item` buys — an
 * independently observed directional rate (NOT the inverse of the pair
 * currency's own page; the difference between the two directions is the real
 * bid/ask spread). Each page lists only outbound pairs against the core
 * currencies (divine/exalted/chaos).
 */
const PoeNinjaPairHistoryPointSchema = z.object({
  timestamp: z.string(),
  rate: z.number(),
  volumePrimaryValue: z.number(),
})

const PoeNinjaPairSchema = z.object({
  id: z.string(),
  // poe.ninja omits `rate` for pairs with no observed market in this direction;
  // buildEdges already skips rate-less pairs, so treat it as genuinely optional.
  rate: z.number().optional(),
  volumePrimaryValue: z.number().optional(),
  history: z.array(PoeNinjaPairHistoryPointSchema).optional(),
})

const PoeNinjaDetailsResponseSchema = z.object({
  item: PoeNinjaItemSchema,
  pairs: z.array(PoeNinjaPairSchema),
  core: PoeNinjaCoreSchema,
})

export type PoeNinjaItem = z.infer<typeof PoeNinjaItemSchema>
export type PoeNinjaCore = z.infer<typeof PoeNinjaCoreSchema>
export type PoeNinjaLine = z.infer<typeof PoeNinjaLineSchema>
export type PoeNinjaOverviewResponse = z.infer<typeof PoeNinjaOverviewResponseSchema>
export type PoeNinjaPairHistoryPoint = z.infer<typeof PoeNinjaPairHistoryPointSchema>
export type PoeNinjaPair = z.infer<typeof PoeNinjaPairSchema>
export type PoeNinjaDetailsResponse = z.infer<typeof PoeNinjaDetailsResponseSchema>

export const fetchOverview = async (
  league: string,
  type: ExchangeType,
): Promise<PoeNinjaOverviewResponse> => {
  const url = `${BASE_URL}/overview?league=${encodeURIComponent(league)}&type=${type}`
  const res = await ninjaFetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`poe.ninja returned ${res.status} for ${url}`)
  return PoeNinjaOverviewResponseSchema.parse(await res.json())
}

export const fetchDetails = async (
  league: string,
  type: ExchangeType,
  detailsId: string,
): Promise<PoeNinjaDetailsResponse> => {
  const url = `${BASE_URL}/details?league=${encodeURIComponent(league)}&type=${type}&id=${encodeURIComponent(detailsId)}`
  const res = await ninjaFetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`poe.ninja returned ${res.status} for ${url}`)
  return PoeNinjaDetailsResponseSchema.parse(await res.json())
}

/** Fetch details for every item in the overview, `concurrency` at a time. */
export const fetchAllDetails = async (
  league: string,
  type: ExchangeType,
  overview: PoeNinjaOverviewResponse,
  concurrency = 4,
): Promise<PoeNinjaDetailsResponse[]> => {
  const detailsIds = overview.items
    .map(item => item.detailsId)
    .filter((id): id is string => Boolean(id))
  const results: PoeNinjaDetailsResponse[] = []
  let next = 0

  const worker = async (): Promise<void> => {
    while (next < detailsIds.length) {
      const id = detailsIds[next++]!
      try {
        results.push(await fetchDetails(league, type, id))
      } catch (err) {
        // A single missing item page shouldn't sink the whole poll.
        console.error(`[poeNinja] details fetch failed for ${type}/${id}:`, err)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, detailsIds.length) }, worker))
  return results
}

/**
 * Builds the rate graph from observed market rates ONLY — no inverted or
 * derived rates. Inverting a rate would fabricate a spread-free market and
 * produce fake arbitrage, so a direction is included iff poe.ninja reports it:
 *
 * 1. Overview `maxVolumeRate`: maxVolumeCurrency -> line currency (the one
 *    observed inbound rate each currency has, from its busiest market).
 * 2. Details `pairs[].rate`: item -> pair currency (each currency's observed
 *    outbound rates against the core hubs divine/exalted/chaos).
 *
 * The two directions of a pair come from different observations, so their
 * product < 1 by the real spread; cycle products > 1 are genuine cross-rate
 * inconsistencies. Details edges are pushed last so they win on duplicates.
 */
const CDN = 'https://web.poecdn.com'

export const buildIconMap = (overview: PoeNinjaOverviewResponse): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const item of [...overview.items, ...overview.core.items]) {
    if (item.name && item.image) {
      map[item.name] = `${CDN}${item.image}`
    }
  }
  return map
}

/**
 * Currency name → mid value in Divine Orbs. `primaryValue` is already in primary
 * (= Divine) units per the overview core, and the primary itself (Divine Orb) is
 * worth 1 but never appears as a line, so seed it explicitly.
 */
export const buildValueMap = (overview: PoeNinjaOverviewResponse): Record<string, number> => {
  const namesById = new Map<string, string>()
  for (const item of [...overview.items, ...overview.core.items]) {
    namesById.set(item.id, item.name)
  }
  const name = (id: string): string => namesById.get(id) ?? id
  const map: Record<string, number> = { [name(overview.core.primary)]: 1 }
  for (const line of overview.lines) {
    if (line.primaryValue > 0) map[name(line.id)] = line.primaryValue
  }
  return map
}

/**
 * Resolves the three anchor hubs' display names from the Currency overview's core:
 * `primary` is Divine, `secondary` is Exalted, and the remaining core rate is
 * Chaos. Every exchange category prices against these same hubs, so the Currency
 * overview (always fetched, always required) is enough to name them once.
 */
export const resolveHubs = (overview: PoeNinjaOverviewResponse): HubNames => {
  const namesById = new Map<string, string>()
  for (const item of [...overview.items, ...overview.core.items]) {
    namesById.set(item.id, item.name)
  }
  const name = (id: string): string => namesById.get(id) ?? id
  const { primary, secondary, rates } = overview.core
  const chaosId = Object.keys(rates).find(id => id !== primary && id !== secondary)
  return {
    divine: name(primary),
    exalted: name(secondary),
    chaos: chaosId ? name(chaosId) : name('chaos'),
  }
}

export const buildEdges = (
  overview: PoeNinjaOverviewResponse,
  detailsList: PoeNinjaDetailsResponse[],
  category: ExchangeType,
): RateEdge[] => {
  const namesById = new Map<string, string>()
  for (const item of [...overview.items, ...overview.core.items]) {
    namesById.set(item.id, item.name)
  }
  const name = (id: string): string => namesById.get(id) ?? id
  const edges: RateEdge[] = []
  const detailsByItemId = new Map(detailsList.map(d => [d.item.id, d]))

  for (const line of overview.lines) {
    if (
      line.maxVolumeCurrency &&
      line.maxVolumeCurrency !== line.id &&
      line.maxVolumeRate &&
      line.maxVolumeRate > 0
    ) {
      // The overview maxVolume edge runs maxVolumeCurrency -> line currency.
      // `line.volumePrimaryValue` is the line currency's *busiest-market* volume,
      // not this specific market's — usually the same (this edge IS the busiest
      // market) but they diverge when the busiest market is a different core hub.
      // The line currency's own details page carries the exact per-market volume
      // for the maxVolumeCurrency pair, so prefer it; fall back to the line figure.
      const market = detailsByItemId.get(line.id)?.pairs.find(p => p.id === line.maxVolumeCurrency)
      edges.push({
        from: name(line.maxVolumeCurrency),
        to: name(line.id),
        rate: line.maxVolumeRate,
        volume: market?.volumePrimaryValue ?? line.volumePrimaryValue ?? 0,
        category,
      })
    }
  }

  for (const details of detailsList) {
    for (const pair of details.pairs) {
      if (pair.id === details.item.id || pair.rate === undefined || pair.rate <= 0) continue
      edges.push({
        from: name(details.item.id),
        to: name(pair.id),
        rate: pair.rate,
        volume: pair.volumePrimaryValue ?? 0,
        category,
      })
    }
  }

  return edges
}

export const toSnapshot = (edges: RateEdge[], league: string): Snapshot => ({
  league,
  sourceTimestamp: null, // payloads carry no generation timestamp
  fetchedAt: Date.now(),
  edges,
})

/** Merged rate edges, icon map, and Divine-value map across every polled exchange category. */
export type EconomySnapshot = {
  edges: RateEdge[]
  icons: Record<string, string>
  values: Record<string, number>
  /** The three anchor hubs' display names, resolved from the Currency overview. */
  hubs: HubNames
}

/**
 * Polls every exchange category in EXCHANGE_TYPES and merges their edges into a
 * single rate graph (all anchor to the same divine/exalted/chaos hub, so
 * triangular arbitrage routes across categories). Currency is the essential hub
 * — if it fails the whole poll fails; any other category failing is logged and
 * skipped so a single dead category can't sink the snapshot.
 */
export const fetchEconomy = async (league: string, concurrency = 4): Promise<EconomySnapshot> => {
  const edges: RateEdge[] = []
  const icons: Record<string, string> = {}
  const values: Record<string, number> = {}
  // Set from the Currency overview below — the essential hub category, fetched
  // first and required, so this is always populated before we return.
  let hubs: HubNames | null = null
  const economyStart = Date.now()
  console.log(
    `[poeNinja] economy poll started for league "${league}" across ${EXCHANGE_TYPES.length} categories`,
  )

  for (const type of EXCHANGE_TYPES) {
    const categoryStart = Date.now()
    let overview: PoeNinjaOverviewResponse
    try {
      overview = await fetchOverview(league, type)
    } catch (err) {
      if (type === 'Currency') throw err
      console.warn(
        `[poeNinja] overview fetch failed for ${type}: ${err instanceof Error ? err.message : err}`,
      )
      continue
    }
    if (type === 'Currency') hubs = resolveHubs(overview)
    const detailsList = await fetchAllDetails(league, type, overview, concurrency)
    const categoryEdges = buildEdges(overview, detailsList, type)
    edges.push(...categoryEdges)
    Object.assign(icons, buildIconMap(overview))
    Object.assign(values, buildValueMap(overview))
    console.log(
      `[poeNinja] ${type}: ${detailsList.length}/${overview.items.length} item details fetched, ` +
        `${categoryEdges.length} edges in ${Date.now() - categoryStart}ms`,
    )
  }

  console.log(
    `[poeNinja] economy poll complete: ${edges.length} edges total in ${Date.now() - economyStart}ms`,
  )
  // hubs is set from the required Currency category; if it somehow isn't, the poll
  // has no usable data and the caller should treat it as a failed poll.
  if (!hubs) throw new Error('economy poll produced no Currency overview to resolve hubs from')
  return { edges, icons, values, hubs }
}

const BuildIndexSchema = z.object({
  leagueBuilds: z.array(
    z.object({
      leagueName: z.string(),
      leagueUrl: z.string(),
      statistics: z
        .array(
          z.object({
            class: z.string(),
            percentage: z.number(),
            trend: z.union([z.literal(1), z.literal(0), z.literal(-1)]),
          }),
        )
        .default([]),
    }),
  ),
})

const fetchBuildIndex = async () => {
  const res = await ninjaFetch('https://poe.ninja/poe2/api/data/build-index-state', {
    headers: HEADERS,
  })
  if (!res.ok) throw new Error(`poe.ninja build-index-state returned ${res.status}`)
  return BuildIndexSchema.parse(await res.json())
}

export const fetchAscendancyTrends = async (leagueName: string) => {
  const { leagueBuilds } = await fetchBuildIndex()
  const match = leagueBuilds.find(l => l.leagueName.toLowerCase() === leagueName.toLowerCase())
  if (!match) throw new Error(`poe.ninja has no build data for league "${leagueName}"`)
  return match.statistics.map(s => ({
    name: s.class,
    pct: s.percentage,
    trend: s.trend,
  }))
}

// --- Main skills (poe.ninja builds "main skills" sidebar) ---
//
// The builds page is fed by a binary-protobuf search API rather than JSON:
//   1. /poe2/api/data/index-state  -> snapshot {version, snapshotName} per league
//   2. /poe2/api/builds/{version}/search?overview={snapshotName}  -> SearchResult
//      proto whose `dimensions` are the sidebar facets. The "skills" dimension
//      is the main-skill list: repeated {id, count}.
//   3. /poe2/api/builds/dictionary/{hash}  -> content-addressed name table; the
//      "skills" dimension's ids index into it.
// Trend isn't in the payload — poe.ninja derives the sidebar arrows from its
// "time machine", so we diff build-share against the `week-1` snapshot.

const BUILDS_BASE = 'https://poe.ninja/poe2/api/builds'
// The search/dictionary endpoints serve protobuf; ask for anything (verified) so
// the JSON-only Accept header used elsewhere doesn't trip a 406.
const PROTOBUF_HEADERS = { Accept: '*/*', 'User-Agent': HEADERS['User-Agent'] }

/** The main-skill facet's dimension key and the trend comparison window. */
const SKILLS_DIMENSION = 'skills'
const TREND_WINDOW = 'week-1'
/** Share-point delta below which a skill is considered flat (avoids arrow jitter). */
const TREND_THRESHOLD_PCT = 0.1

const SnapshotVersionSchema = z.object({
  url: z.string(),
  name: z.string(),
  snapshotName: z.string(),
  version: z.string(),
})
const IndexStateSchema = z.object({ snapshotVersions: z.array(SnapshotVersionSchema) })

const fetchSnapshotVersion = async (leagueName: string) => {
  const res = await ninjaFetch('https://poe.ninja/poe2/api/data/index-state', { headers: HEADERS })
  if (!res.ok) throw new Error(`poe.ninja index-state returned ${res.status}`)
  const { snapshotVersions } = IndexStateSchema.parse(await res.json())
  const lc = leagueName.toLowerCase()
  const match = snapshotVersions.find(
    s => s.name.toLowerCase() === lc || s.url.toLowerCase() === lc,
  )
  if (!match) throw new Error(`poe.ninja has no build snapshot for league "${leagueName}"`)
  return match
}

/** Fetches a builds search snapshot and decodes the SearchResult proto inside it. */
const fetchSearchResult = async (
  version: string,
  snapshotName: string,
  timeMachine?: string,
): Promise<SearchResult> => {
  const params = new URLSearchParams({ overview: snapshotName })
  if (timeMachine) params.set('timeMachine', timeMachine)
  const res = await ninjaFetch(`${BUILDS_BASE}/${version}/search?${params}`, {
    headers: PROTOBUF_HEADERS,
  })
  if (!res.ok) throw new Error(`poe.ninja builds search returned ${res.status}`)
  return decodeSearchResult(new Uint8Array(await res.arrayBuffer()))
}

/** Pulls the main-skill facet (dimension key "skills") out of a SearchResult. */
const readSkillDimension = (searchResult: SearchResult) =>
  searchResult.dimensions.find(d => d.key === SKILLS_DIMENSION) ?? null

/** Finds the content hash of the dictionary that resolves a dimension's ids. */
const resolveDictionaryHash = (searchResult: SearchResult, label: string) =>
  searchResult.dictionaries.find(d => d.label === label)?.hash

/** Fetches a dictionary; field 2 is the name list indexed by entry id. */
const fetchDictionaryNames = async (hash: string): Promise<string[]> => {
  const res = await ninjaFetch(`${BUILDS_BASE}/dictionary/${hash}`, { headers: PROTOBUF_HEADERS })
  if (!res.ok) throw new Error(`poe.ninja dictionary returned ${res.status}`)
  return decodeDictionaryNames(new Uint8Array(await res.arrayBuffer()))
}

/** Build-share by skill id (count / total * 100) for one snapshot. */
const skillShareById = (searchResult: SearchResult): Map<number, number> => {
  const dimension = readSkillDimension(searchResult)
  const { total } = searchResult
  const share = new Map<number, number>()
  if (dimension && total > 0) {
    for (const e of dimension.entries) share.set(e.id, (e.count / total) * 100)
  }
  return share
}

/**
 * Reads poe.ninja's "main skills" sidebar for a league: current build-share per
 * skill plus a week-over-week trend inferred from the time-machine snapshot.
 * Returns the top `topN` skills by current share.
 */
export const fetchMainSkills = async (leagueName: string, topN = 20): Promise<MainSkillTrend[]> => {
  const { version, snapshotName } = await fetchSnapshotVersion(leagueName)

  const current = await fetchSearchResult(version, snapshotName)
  const dimension = readSkillDimension(current)
  if (!dimension) throw new Error('poe.ninja search response has no skills dimension')

  const total = current.total || dimension.entries.reduce((sum, e) => sum + e.count, 0)
  const hash = resolveDictionaryHash(current, dimension.label)
  const names = hash ? await fetchDictionaryNames(hash) : []

  // Past snapshot for trend — best-effort. If it's missing (e.g. a league less
  // than a week old, where week-1 clamps to now), trends stay flat.
  let pastShare = new Map<number, number>()
  try {
    pastShare = skillShareById(await fetchSearchResult(version, snapshotName, TREND_WINDOW))
  } catch (err) {
    console.warn(
      `[poeNinja] main-skill trend fetch failed: ${err instanceof Error ? err.message : err}`,
    )
  }

  return dimension.entries
    .map(({ id, count }) => {
      const pct = total > 0 ? (count / total) * 100 : 0
      const prev = pastShare.get(id)
      const delta = prev === undefined ? 0 : pct - prev
      const trend = delta > TREND_THRESHOLD_PCT ? 1 : delta < -TREND_THRESHOLD_PCT ? -1 : 0
      return { name: names[id] ?? '', pct, count, trend: trend as 1 | 0 | -1 }
    })
    .filter(skill => skill.name !== '') // drop ids we couldn't resolve to a name
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}
