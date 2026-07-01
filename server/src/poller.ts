import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import type { Arbitrage, AscendancyTrend, MainSkillTrend, Snapshot } from '@poe2-dashboard/shared'
import { ArbitrageSnapshotSchema } from '@poe2-dashboard/shared'
import { ARBITRAGE_SNAPSHOT_PATH } from '@poe2-dashboard/shared/arbitrageSnapshot'

import { findTriangularArbitrages } from './arbitrage.js'
import { buildGraph } from './graph.js'
import { fetchAscendancyTrends, fetchEconomy, fetchMainSkills, toSnapshot } from './poeNinja.js'

export type PollerOptions = {
  league: string
  intervalMs: number
}

export type PollerState = {
  snapshot: Snapshot | null
  /** Unfiltered, sorted by profit desc. Route handlers filter on read. */
  arbitrages: Arbitrage[]
  currencyIcons: Record<string, string>
  currencyValues: Record<string, number>
  ascendancyTrends: AscendancyTrend[]
  mainSkills: MainSkillTrend[]
  lastError: string | null
}

export const createPoller = (options: PollerOptions) => {
  const state: PollerState = {
    snapshot: null,
    arbitrages: [],
    currencyIcons: {},
    currencyValues: {},
    ascendancyTrends: [],
    mainSkills: [],
    lastError: null,
  }

  // Rehydrate the Arbitrage widget's data from the last run so the UI renders
  // immediately instead of the empty "Fetching rates…" state while the first
  // multi-minute poll runs. Best-effort: a missing/invalid/foreign-league cache
  // just leaves state empty, and the first poll fills (and overwrites) it.
  try {
    const cached = ArbitrageSnapshotSchema.parse(
      JSON.parse(readFileSync(ARBITRAGE_SNAPSHOT_PATH, 'utf8')),
    )
    if (cached.league === options.league) {
      state.snapshot = {
        league: cached.league,
        sourceTimestamp: null,
        // edges aren't served or reused — the next poll recomputes them from a
        // fresh fetch — so an empty list here is enough to drive the age badge.
        fetchedAt: cached.fetchedAt,
        edges: [],
      }
      state.arbitrages = cached.arbitrages
      state.currencyIcons = cached.currencyIcons
      state.currencyValues = cached.currencyValues
      console.log(
        `[poller] restored ${cached.arbitrages.length} arbitrages from cache ` +
          `(fetchedAt=${new Date(cached.fetchedAt).toISOString()})`,
      )
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(
        `[poller] could not load arbitrage snapshot cache: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  let ascendancyFetchFailed = false
  let mainSkillsFetchFailed = false

  // One economy poll fans out to hundreds of rate-limited requests and can take
  // several minutes — longer than the poll interval if it's set low. Without this
  // guard, the interval timer launches overlapping polls that all contend for the
  // shared rate limiter, so each poll runs slower than the last and the backlog
  // grows without bound. Skip-if-running keeps exactly one poll in flight.
  let polling = false

  const pollOnce = async (): Promise<void> => {
    if (polling) {
      console.warn('[poller] poll already in progress; skipping this interval')
      return
    }
    polling = true
    const start = Date.now()
    console.log(`[poller] poll starting for league "${options.league}"`)
    try {
      const economy = await fetchEconomy(options.league)
      const snapshot = toSnapshot(economy.edges, options.league)
      state.snapshot = snapshot
      state.arbitrages = findTriangularArbitrages(buildGraph(snapshot.edges))
      state.currencyIcons = economy.icons
      state.currencyValues = economy.values
      state.lastError = null
      console.log(
        `[poller] poll complete in ${Date.now() - start}ms: ${economy.edges.length} edges, ` +
          `${state.arbitrages.length} arbitrages, snapshot fetchedAt=${new Date(snapshot.fetchedAt).toISOString()}`,
      )
      // Persist the widget's display data so the next startup can render it
      // immediately. Fire-and-forget: a write failure shouldn't fail the poll.
      void writeFile(
        ARBITRAGE_SNAPSHOT_PATH,
        `${JSON.stringify({
          league: snapshot.league,
          fetchedAt: snapshot.fetchedAt,
          arbitrages: state.arbitrages,
          currencyIcons: state.currencyIcons,
          currencyValues: state.currencyValues,
        })}\n`,
        'utf8',
      ).catch(err => {
        console.warn(
          `[poller] could not write arbitrage snapshot cache: ${err instanceof Error ? err.message : err}`,
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
      // Released once the economy fetch + arbitrage compute finishes; the
      // best-effort build-data fetches above are fire-and-forget and don't hold
      // the next poll back.
      polling = false
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
