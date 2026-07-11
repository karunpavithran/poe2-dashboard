import type {
  Arbitrage,
  AtlasStrategy,
  AtlasStrategyInput,
  BestExchangeMap,
  EconomyResponse,
  ExchangeType,
} from '@poe2-dashboard/shared'
import {
  AtlasResponseSchema,
  buildGraph,
  BuildTrendsResponseSchema,
  computeBestExchange,
  computeCurrencyCategories,
  EconomyResponseSchema,
  findTriangularArbitrages,
  StreamsResponseSchema,
} from '@poe2-dashboard/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createResourceQuery } from '@/lib/createResourceQuery.js'
import { extractTags, isSoftcore } from '@/lib/streamTransforms.js'

export const fetchStreams = async () => {
  const res = await fetch('/api/streams')
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return StreamsResponseSchema.parse(await res.json())
}

// Stream data is informational, not time-critical: the server caches its one
// snapshot indefinitely, so no background polling — the data only changes when
// the user explicitly refreshes (useRefreshStreams).
export const { useResource: useStreams, queryKey: streamsQueryKey } = createResourceQuery({
  name: 'streams',
  fetcher: fetchStreams,
  refetchInterval: false,
  transform: raw => ({
    ...raw,
    softcoreStreams: raw.streams.filter(isSoftcore),
    tags: extractTags(raw.streams),
  }),
})

export const fetchBuildTrends = async () => {
  const res = await fetch('/api/build-trends')
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return BuildTrendsResponseSchema.parse(await res.json())
}

export const { useResource: useBuildTrends, queryKey: buildTrendsQueryKey } = createResourceQuery({
  name: 'buildTrends',
  fetcher: fetchBuildTrends,
  refetchInterval: false,
  transform: raw => ({
    ...raw,
    softcoreStreams: raw.streams.filter(isSoftcore),
    tags: extractTags(raw.streams),
  }),
})

// Force the server to replace its cached Twitch snapshot (the only path that
// spends a Twitch + Claude tagging call), then refetch both resources built on
// it. Awaits the server-side fetch, so isPending covers the whole refresh.
export const requestStreamsRefresh = async (): Promise<void> => {
  const res = await fetch('/api/streams/refresh', { method: 'POST' })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
}

export const useRefreshStreams = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: requestStreamsRefresh,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: streamsQueryKey }),
        queryClient.invalidateQueries({ queryKey: buildTrendsQueryKey }),
      ]),
  })
}

// The server ships the minimal economy source (edges + value/icon maps + hubs);
// we fetch it once under a stable key and derive every view client-side. All
// filtering (categories, minProfit, minVolume) then happens over the derived
// rows in useArbitrages without ever refetching.
export const fetchArbitrages = async () => {
  const res = await fetch('/api/arbitrages')
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  const data = EconomyResponseSchema.parse(await res.json())
  // Snapshot freshness summary: correlate `updatedAt` with the server's poller
  // `fetchedAt` log. A large `dataAgeMs` here means the client is sitting on a
  // stale snapshot — i.e. it hasn't refetched since the server got new data.
  console.log(
    `[api] economy received: ${data.edges.length} edges, ` +
      `updatedAt=${data.updatedAt === null ? 'none' : new Date(data.updatedAt).toISOString()}, ` +
      `dataAgeMs=${data.dataAgeMs ?? 'n/a'}${data.lastError ? `, lastError=${data.lastError}` : ''}`,
  )
  return data
}

/**
 * The economy source plus everything the client derives from `edges`: arbitrage
 * cycles, per-hub buy/sell rates, and currency→category. Downstream components
 * read these fields exactly as they did when the server precomputed them.
 */
export type DerivedEconomy = EconomyResponse & {
  arbitrages: Arbitrage[]
  bestBuy: BestExchangeMap
  bestSell: BestExchangeMap
  currencyCategories: Record<string, ExchangeType[]>
}

// Runs inside the query fn (once per fetch, then cached) — see createResourceQuery.
// The triangular search is edge-driven and sparse, so this is tens of ms even at
// full scale; if it ever grows, move it to a web worker.
const deriveEconomy = (raw: EconomyResponse): DerivedEconomy => {
  const graph = buildGraph(raw.edges)
  const { bestBuy, bestSell } = computeBestExchange(graph, raw.currencyValues, raw.hubs)
  return {
    ...raw,
    arbitrages: findTriangularArbitrages(graph),
    bestBuy,
    bestSell,
    currencyCategories: computeCurrencyCategories(raw.edges, raw.hubs),
  }
}

export const { useResource: useArbitragesQuery, queryKey: arbitragesQueryKey } =
  createResourceQuery({
    name: 'arbitrages',
    fetcher: fetchArbitrages,
    transform: deriveEconomy,
  })

// Ask the server to kick a fresh economy poll. Reading GET /api/arbitrages only
// ever returns the cached snapshot, so this is the sole way the client can pull
// data newer than the last scheduled server poll. Returns 202 right away; the
// poll runs for minutes, and the query's background refetch surfaces the result.
export const requestArbitrageRefresh = async (): Promise<void> => {
  const res = await fetch('/api/arbitrages/refresh', { method: 'POST' })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
}

export const useRefreshArbitrages = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: requestArbitrageRefresh,
    // Refetch immediately so the badge flips to "refreshing…" (isRefreshing=true)
    // without waiting for the next background poll to notice the poll started.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: arbitragesQueryKey }),
  })
}

export const fetchAtlas = async (): Promise<AtlasStrategy[]> => {
  const res = await fetch('/api/atlas')
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return AtlasResponseSchema.parse(await res.json()).strategies
}

export const createStrategy = async (input: AtlasStrategyInput): Promise<void> => {
  const res = await fetch('/api/atlas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
}

// The id travels in the route, not the body (the server ignores a body id).
export const updateStrategy = async (strategy: AtlasStrategy): Promise<void> => {
  const { id, ...input } = strategy
  const res = await fetch(`/api/atlas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
}

export const deleteStrategy = async (id: string): Promise<void> => {
  const res = await fetch(`/api/atlas/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
}

export const { useResource: useAtlas, queryKey: atlasQueryKey } = createResourceQuery({
  name: 'atlas',
  fetcher: fetchAtlas,
})

// The server owns display order (position) and timestamps, so mutations refetch
// the authoritative list instead of patching the cache locally. Returning the
// invalidate promise keeps the mutation `isPending` until the refetch lands, so
// callers' onSuccess (e.g. closing the editor) fires against fresh data.
const useAtlasMutation = <TInput>(mutationFn: (input: TInput) => Promise<void>) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasQueryKey }),
  })
}

export const useCreateStrategy = () => useAtlasMutation(createStrategy)
export const useUpdateStrategy = () => useAtlasMutation(updateStrategy)
export const useDeleteStrategy = () => useAtlasMutation(deleteStrategy)
