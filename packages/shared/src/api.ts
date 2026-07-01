import type { z } from 'zod'

import type {
  ArbitragesParamsSchema,
  ArbitragesResponseSchema,
  AtlasResponseSchema,
  BuildTrendsResponseSchema,
} from './schemas.js'

/** Query params accepted by GET /api/arbitrages. */
export type ArbitragesQuery = z.infer<typeof ArbitragesParamsSchema>

/** Response body of GET /api/arbitrages. */
export type ArbitragesResponse = z.infer<typeof ArbitragesResponseSchema>

/** Response body of GET /api/build-trends. */
export type BuildTrendsResponse = z.infer<typeof BuildTrendsResponseSchema>

/** Response body of GET /api/atlas and request body of PUT /api/atlas. */
export type AtlasResponse = z.infer<typeof AtlasResponseSchema>
