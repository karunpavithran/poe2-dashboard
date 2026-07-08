import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import type {
  AscendancyTrend,
  HubNames,
  MainSkillTrend,
  RateEdge,
  Snapshot,
} from '@poe2-dashboard/shared'
import { EconomySnapshotSchema } from '@poe2-dashboard/shared'
import { ARBITRAGE_SNAPSHOT_PATH } from '@poe2-dashboard/shared/arbitrageSnapshot'

import { fetchAscendancyTrends, fetchEconomy, fetchMainSkills, toSnapshot } from './poeNinja.js'

export type PollerOptions = {
  league: string
  intervalMs: number
}

export type PollerState = {
  snapshot: Snapshot | null
  /**
   * Every observed directed exchange edge from the last poll — the *minimal
   * economy source*. The client rebuilds the rate graph and derives arbitrage
   * cycles, per-hub buy/sell rates, and currency→category from these, so the
   * server ships them as-is rather than precomputing those views.
   */
  edges: RateEdge[]
  currencyIcons: Record<string, string>
  currencyValues: Record<string, number>
  /** The three anchor hubs' display names, for labelling the buy/sell comparison. */
  hubs: HubNames
  ascendancyTrends: AscendancyTrend[]
  mainSkills: MainSkillTrend[]
  lastError: string | null
  /**
   * True while pollOnce is running. Exposed on state (not just a closure flag)
   * so route handlers can report an in-flight poll to clients — an on-demand
   * refresh takes minutes, so the UI needs to reflect it for the whole window.
   */
  isPolling: boolean
}

export const createPoller = (options: PollerOptions) => {
  const state: PollerState = {
    snapshot: null,
    edges: [],
    currencyIcons: {},
    currencyValues: {},
    hubs: { divine: 'Divine Orb', exalted: 'Exalted Orb', chaos: 'Chaos Orb' },
    ascendancyTrends: [],
    mainSkills: [],
    lastError: null,
    isPolling: false,
  }

  // Rehydrate the Exchanges widget's data from the last run so the UI renders
  // immediately instead of the empty "Fetching rates…" state while the first
  // multi-minute poll runs. Best-effort: a missing/invalid/foreign-league cache
  // just leaves state empty, and the first poll fills (and overwrites) it.
  try {
    const cached = EconomySnapshotSchema.parse(
      JSON.parse(readFileSync(ARBITRAGE_SNAPSHOT_PATH, 'utf8')),
    )
    if (cached.league === options.league) {
      state.snapshot = {
        league: cached.league,
        sourceTimestamp: null,
        fetchedAt: cached.fetchedAt,
        edges: cached.edges,
      }
      state.edges = cached.edges
      state.currencyIcons = cached.currencyIcons
      state.currencyValues = cached.currencyValues
      state.hubs = cached.hubs
      console.log(
        `[poller] restored ${cached.edges.length} edges from cache ` +
          `(fetchedAt=${new Date(cached.fetchedAt).toISOString()})`,
      )
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(
        `[poller] could not load economy snapshot cache: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  let ascendancyFetchFailed = false
  let mainSkillsFetchFailed = false

  // One economy poll fans out to hundreds of rate-limited requests and can take
  // several minutes — longer than the poll interval if it's set low. Without this
  // guard, the interval timer launches overlapping polls that all contend for the
  // shared rate limiter, so each poll runs slower than the last and the backlog
  // grows without bound. Skip-if-running keeps exactly one poll in flight, and
  // makes an on-demand refresh POST while a poll is already running a no-op.
  const pollOnce = async (): Promise<void> => {
    if (state.isPolling) {
      console.warn('[poller] poll already in progress; skipping this interval')
      return
    }
    state.isPolling = true
    const start = Date.now()
    console.log(`[poller] poll starting for league "${options.league}"`)
    try {
      const economy = await fetchEconomy(options.league)
      const snapshot = toSnapshot(economy.edges, options.league)
      state.snapshot = snapshot
      // Ship the raw edges; the client derives cycles and per-hub rates from them.
      state.edges = snapshot.edges
      state.hubs = economy.hubs
      state.currencyIcons = economy.icons
      state.currencyValues = economy.values
      state.lastError = null
      console.log(
        `[poller] poll complete in ${Date.now() - start}ms: ${snapshot.edges.length} edges, ` +
          `snapshot fetchedAt=${new Date(snapshot.fetchedAt).toISOString()}`,
      )
      // Persist the widget's source data so the next startup can render it
      // immediately. Fire-and-forget: a write failure shouldn't fail the poll.
      void writeFile(
        ARBITRAGE_SNAPSHOT_PATH,
        `${JSON.stringify({
          league: snapshot.league,
          fetchedAt: snapshot.fetchedAt,
          edges: state.edges,
          currencyValues: state.currencyValues,
          currencyIcons: state.currencyIcons,
          hubs: state.hubs,
        })}\n`,
        'utf8',
      ).catch(err => {
        console.warn(
          `[poller] could not write economy snapshot cache: ${err instanceof Error ? err.message : err}`,
        )
      })
      // Build data fetches are best-effort — failure doesn't invalidate currency data.
      fetchAscendancyTrends(options.league)
        .then(trends => {
          state.ascendancyTrends = trends
          ascendancyFetchFailed = false
        })
        .catch(err => {
          if (!ascendancyFetchFailed) {
            console.warn(
              `[poller] ascendancy fetch failed: ${err instanceof Error ? err.message : err}`,
            )
            ascendancyFetchFailed = true
          }
        })
      fetchMainSkills(options.league)
        .then(skills => {
          state.mainSkills = skills
          mainSkillsFetchFailed = false
        })
        .catch(err => {
          if (!mainSkillsFetchFailed) {
            console.warn(
              `[poller] main-skill fetch failed: ${err instanceof Error ? err.message : err}`,
            )
            mainSkillsFetchFailed = true
          }
        })
    } catch (err) {
      // Keep serving the last good snapshot; surface the failure to clients.
      state.lastError = err instanceof Error ? err.message : String(err)
      console.error(`[poller] poll failed after ${Date.now() - start}ms: ${state.lastError}`)
    } finally {
      // Released once the economy fetch finishes; the best-effort build-data
      // fetches above are fire-and-forget and don't hold the next poll back.
      state.isPolling = false
    }
  }

  let timer: NodeJS.Timeout | null = null

  return {
    state,
    pollOnce,
    start: () => {
      void pollOnce()
      timer = setInterval(() => void pollOnce(), options.intervalMs)
    },
    stop: () => {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
