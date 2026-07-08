import type { z } from 'zod'

import type {
  AtlasResponseSchema,
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

/** Response body of GET /api/atlas and request body of PUT /api/atlas. */
export type AtlasResponse = z.infer<typeof AtlasResponseSchema>
