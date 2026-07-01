import type { AtlasStrategy } from '@poe2-dashboard/shared'
import {
  ArbitragesResponseSchema,
  AtlasResponseSchema,
  BuildTrendsResponseSchema,
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

export const { useResource: useStreams } = createResourceQuery({
  name: 'streams',
  fetcher: fetchStreams,
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

export const { useResource: useBuildTrends } = createResourceQuery({
  name: 'buildTrends',
  fetcher: fetchBuildTrends,
  transform: raw => ({
    ...raw,
    softcoreStreams: raw.streams.filter(isSoftcore),
    tags: extractTags(raw.streams),
  }),
})

// Every filter (categories, minProfit, minVolume) is applied client-side in
// useArbitrages, so we fetch the full unfiltered set once under a stable key and
// let the UI narrow it without ever refetching. The server returns the complete
// superset when no thresholds are passed.
export const fetchArbitrages = async () => {
  const res = await fetch('/api/arbitrages')
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  const data = ArbitragesResponseSchema.parse(await res.json())
  // Snapshot freshness summary: correlate `updatedAt` with the server's poller
  // `fetchedAt` log. A large `dataAgeMs` here means the client is sitting on a
  // stale snapshot — i.e. it hasn't refetched since the server got new data.
  console.log(
    `[api] arbitrages received: ${data.arbitrages.length} rows, ` +
      `updatedAt=${data.updatedAt === null ? 'none' : new Date(data.updatedAt).toISOString()}, ` +
      `dataAgeMs=${data.dataAgeMs ?? 'n/a'}${data.lastError ? `, lastError=${data.lastError}` : ''}`,
  )
  return data
}

export const { useResource: useArbitragesQuery } = createResourceQuery({
  name: 'arbitrages',
  fetcher: fetchArbitrages,
})

export const fetchAtlas = async (): Promise<AtlasStrategy[]> => {
  const res = await fetch('/api/atlas')
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return AtlasResponseSchema.parse(await res.json()).strategies
}

export const saveAtlas = async (strategies: AtlasStrategy[]): Promise<void> => {
  const res = await fetch('/api/atlas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategies }),
  })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
}

export const { useResource: useAtlas, queryKey: atlasQueryKey } = createResourceQuery({
  name: 'atlas',
  fetcher: fetchAtlas,
})

export const useSaveAtlas = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveAtlas,
    onSuccess: (_, strategies) => {
      queryClient.setQueryData(atlasQueryKey, strategies)
    },
  })
}
