import type { z } from 'zod'

import type {
  ApiErrorSchema,
  AtlasResponseSchema,
  AtlasStrategyInputSchema,
  AtlasStrategyParamsSchema,
  BuildTrendsResponseSchema,
  EconomyResponseSchema,
} from './schemas.js'

/**
 * Response body of GET /api/arbitrages — the minimal economy source (edges +
 * value/icon maps + hubs + freshness meta). The client derives arbitrage cycles,
 * per-hub rates, and currency→category from `edges`.
 */
export type EconomyResponse = z.infer<typeof EconomyResponseSchema>

/** Response body of GET /api/build-trends. */
export type BuildTrendsResponse = z.infer<typeof BuildTrendsResponseSchema>

/** Response body of GET /api/atlas: every strategy, most recently updated first. */
export type AtlasResponse = z.infer<typeof AtlasResponseSchema>

/** Route params for the per-strategy endpoints (PUT/DELETE /api/atlas/:id). */
export type AtlasStrategyParams = z.infer<typeof AtlasStrategyParamsSchema>

/** Request body of POST /api/atlas and PUT /api/atlas/:id — a strategy minus its id. */
export type AtlasStrategyInput = z.infer<typeof AtlasStrategyInputSchema>

/** Error body for non-2xx API responses. */
export type ApiError = z.infer<typeof ApiErrorSchema>
