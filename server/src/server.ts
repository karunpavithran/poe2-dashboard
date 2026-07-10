import compress from '@fastify/compress'
import fastifyStatic from '@fastify/static'
import type { BuildTrendsResponse, EconomyResponse } from '@poe2-dashboard/shared'
import Fastify from 'fastify'

import type { PollerState } from './poller.js'
import { atlasRouter } from './slices/atlas/atlas.router.js'
import type { TwitchPollerState } from './twitch.js'
import { toStreamsResponse } from './twitch.js'

export const createServer = async (
  state: PollerState,
  league: string,
  twitchState: TwitchPollerState,
  /**
   * Kicks a fresh economy poll for the on-demand refresh route. Fire-and-forget:
   * the poll takes minutes, so the route returns immediately and clients observe
   * completion via `isRefreshing`/`updatedAt` on subsequent GET /api/arbitrages.
   */
  refreshArbitrages: () => void,
  /**
   * Absolute path to the built client (Vite dist). Set in the Docker image so
   * the one container serves API + SPA; unset in dev, where Vite's dev server
   * owns the front end and proxies /api here.
   */
  clientDist?: string,
) => {
  const app = Fastify({ logger: true, disableRequestLogging: true })

  // Gzip responses. The economy payload is a normalized edge list (a few hundred
  // KB uncompressed) that compresses ~6x, so this is the cheapest win on transfer
  // size. Must be awaited *before* the routes are defined so its onSend hook is
  // installed by the time each route is registered (otherwise it never applies).
  await app.register(compress)

  app.get('/api/health', () => ({
    ok: true,
    hasData: state.snapshot !== null,
    lastError: state.lastError,
  }))

  // The *minimal economy source*: observed rate edges + the per-currency
  // value/icon maps + hub names. All filtering and every derived view (arbitrage
  // cycles, per-hub buy/sell rates, currency→category) is computed client-side
  // from `edges`, so this route takes no query params and always returns the full
  // set — the client fetches it once and re-derives without refetching.
  app.get('/api/arbitrages', (): EconomyResponse => {
    const snapshot = state.snapshot
    return {
      league,
      edges: state.edges,
      currencyValues: state.currencyValues,
      currencyIcons: state.currencyIcons,
      hubs: state.hubs,
      updatedAt: snapshot?.fetchedAt ?? null,
      dataAgeMs: snapshot ? Date.now() - snapshot.fetchedAt : null,
      isRefreshing: state.isPolling,
      lastError: state.lastError,
    }
  })

  // On-demand refresh: kick a poll and return 202 immediately. The poller's
  // skip-if-running guard coalesces concurrent clicks (and the scheduled poll)
  // into a single in-flight poll, so spamming this is harmless. Clients watch
  // `isRefreshing` on GET /api/arbitrages to know when it lands.
  app.post('/api/arbitrages/refresh', (_req, reply) => {
    refreshArbitrages()
    reply.code(202).send({ isRefreshing: true })
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

  await app.register(atlasRouter, { prefix: '/api/atlas' })

  if (clientDist) {
    await app.register(fastifyStatic, { root: clientDist })
    // SPA fallback: unknown non-API paths are client-side routes and get
    // index.html; unknown /api paths stay JSON 404s.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ message: `Route ${req.method} ${req.url} not found` })
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
