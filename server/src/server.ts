import { readFile, writeFile } from 'node:fs/promises'

import type {
  ArbitragesResponse,
  AtlasResponse,
  BuildTrendsResponse,
  ExchangeType,
} from '@poe2-dashboard/shared'
import { AtlasResponseSchema, ExchangeTypeSchema } from '@poe2-dashboard/shared'
import { ATLAS_DATA_PATH } from '@poe2-dashboard/shared/atlas'
import Fastify from 'fastify'

import { applyFilters } from './filters.js'
import type { PollerState } from './poller.js'
import type { TwitchPollerState } from './twitch.js'
import { toStreamsResponse } from './twitch.js'

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Parse the comma-separated `categories` param into a validated set. Unknown
 * values are dropped; an absent or empty param means no filtering (undefined).
 */
const parseCategories = (value: string | undefined): Set<ExchangeType> | undefined => {
  if (!value) return undefined
  const selected = value
    .split(',')
    .map(part => ExchangeTypeSchema.safeParse(part.trim()))
    .filter(result => result.success)
    .map(result => result.data)
  return selected.length > 0 ? new Set(selected) : undefined
}

export const createServer = (
  state: PollerState,
  league: string,
  twitchState: TwitchPollerState,
) => {
  const app = Fastify({ logger: true, disableRequestLogging: true })

  app.get('/api/health', () => ({
    ok: true,
    hasData: state.snapshot !== null,
    lastError: state.lastError,
  }))

  app.get<{
    Querystring: { minProfit?: string; minVolume?: string; categories?: string }
  }>('/api/arbitrages', (req): ArbitragesResponse => {
    const minProfitPct = parseNumber(req.query.minProfit)
    const minVolume = parseNumber(req.query.minVolume)
    const categories = parseCategories(req.query.categories)
    const snapshot = state.snapshot

    return {
      league,
      updatedAt: snapshot?.fetchedAt ?? null,
      dataAgeMs: snapshot ? Date.now() - snapshot.fetchedAt : null,
      arbitrages: applyFilters(state.arbitrages, {
        minProfitPct,
        minVolume,
        categories,
      }),
      currencyIcons: state.currencyIcons,
      currencyValues: state.currencyValues,
      lastError: state.lastError,
    }
  })

  app.get('/api/streams', () => toStreamsResponse(twitchState))

  app.get(
    '/api/build-trends',
    (): BuildTrendsResponse => ({
      streams: twitchState.streams,
      fetchedAt: twitchState.fetchedAt,
      lastError: twitchState.lastError,
      ascendancies: state.ascendancyTrends,
      mainSkills: state.mainSkills,
      ninjaError: state.lastError,
    }),
  )

  app.get('/api/atlas', async (): Promise<AtlasResponse> => {
    const raw = await readFile(ATLAS_DATA_PATH, 'utf8')
    return AtlasResponseSchema.parse(JSON.parse(raw))
  })

  app.put<{ Body: AtlasResponse }>('/api/atlas', async (req, reply) => {
    const parsed = AtlasResponseSchema.parse(req.body)
    await writeFile(ATLAS_DATA_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
    reply.code(204).send()
  })

  return app
}
