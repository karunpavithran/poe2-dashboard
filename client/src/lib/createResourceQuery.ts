import type {
  AtlasStrategy,
  BuildTrendsResponse,
  EconomyResponse,
  StreamsResponse,
} from '@poe2-dashboard/shared'
import type { UseSuspenseQueryResult } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useSuspenseQuery } from '@tanstack/react-query'

type Resource = 'streams' | 'buildTrends' | 'arbitrages' | 'atlas'

type ResourceDataMap = {
  streams: StreamsResponse
  buildTrends: BuildTrendsResponse
  // Raw wire shape; the arbitrages resource `transform`s this into DerivedEconomy.
  arbitrages: EconomyResponse
  atlas: AtlasStrategy[]
}

// Compile-time guard that ResourceDataMap has an entry for every Resource.
// No binding is created — `satisfies` does the key-coverage check at type level.
void ({} as ResourceDataMap satisfies Record<Resource, unknown>)

type NamedQuery<TName extends Resource, TData> = Record<TName, TData> &
  Record<`refetch${Capitalize<TName>}`, () => void> &
  Record<`is${Capitalize<TName>}Fetching`, boolean>

const namedQuery = <TName extends Resource, TData>(
  name: TName,
  result: UseSuspenseQueryResult<TData>,
): NamedQuery<TName, TData> =>
  ({
    [name]: result.data,
    [`refetch${name.charAt(0).toUpperCase()}${name.slice(1)}`]: result.refetch,
    [`is${name.charAt(0).toUpperCase()}${name.slice(1)}Fetching`]: result.isFetching,
  }) as NamedQuery<TName, TData>

type ResourceConfig<TName extends Resource, TParams, TOut> = {
  name: TName
  fetcher: (params: TParams) => Promise<ResourceDataMap[TName]>
  refetchInterval?: number
  transform?: (raw: ResourceDataMap[TName]) => TOut
  keepPreviousData?: boolean
}

// Poll well below the server's hourly polls so every resource picks up a fresh
// snapshot within ~a minute of it landing, instead of up to an hour later. The
// responses are small and served from the server's in-memory state, so this is
// cheap. A query can still override this via config.refetchInterval.
const DEFAULT_REFETCH_INTERVAL = 60 * 1000

const createResourceQuery = <TName extends Resource, TParams = void, TOut = ResourceDataMap[TName]>(
  config: ResourceConfig<TName, TParams, TOut>,
) => {
  const queryKey = [config.name] as const

  const useResource = (params: TParams): NamedQuery<TName, TOut> => {
    const result = useSuspenseQuery(
      queryOptions({
        queryKey: params === undefined ? queryKey : ([config.name, params] as const),
        queryFn: async (): Promise<TOut> => {
          // Logged so the actual fetch cadence is visible in the console: the
          // refetchInterval here is how long the client waits before pulling the
          // server's next snapshot, independent of how often the server polls.
          const interval = config.refetchInterval ?? DEFAULT_REFETCH_INTERVAL
          const start = performance.now()
          console.log(`[query:${config.name}] fetching (refetchInterval=${interval}ms)`)
          try {
            const raw = await config.fetcher(params)
            console.log(
              `[query:${config.name}] fetched in ${Math.round(performance.now() - start)}ms`,
            )
            return config.transform ? config.transform(raw) : (raw as TOut)
          } catch (err) {
            console.error(
              `[query:${config.name}] fetch failed after ${Math.round(performance.now() - start)}ms:`,
              err,
            )
            throw err
          }
        },
        refetchInterval: config.refetchInterval ?? DEFAULT_REFETCH_INTERVAL,
        placeholderData: config.keepPreviousData ? keepPreviousData : undefined,
      }),
    )
    return namedQuery(config.name, result)
  }

  return { useResource, queryKey }
}

export type { NamedQuery, Resource, ResourceDataMap }
export { createResourceQuery }
