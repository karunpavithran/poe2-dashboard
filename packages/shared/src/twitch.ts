import type { z } from 'zod'

import type { StreamsResponseSchema, TwitchStreamSchema } from './schemas.js'

export type TwitchStream = z.infer<typeof TwitchStreamSchema>

export type StreamsResponse = z.infer<typeof StreamsResponseSchema>
