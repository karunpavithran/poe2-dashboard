import type { ApiError, AtlasResponse, AtlasStrategy } from '@poe2-dashboard/shared'
import { AtlasStrategyInputSchema, AtlasStrategyParamsSchema } from '@poe2-dashboard/shared'
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import { createStrategy, deleteStrategy, listStrategies, updateStrategy } from './atlas.service.js'

const badRequest = (reply: FastifyReply, error: z.ZodError): ApiError => {
  reply.code(400)
  return { message: z.prettifyError(error) }
}

const notFound = (reply: FastifyReply, id: string): ApiError => {
  reply.code(404)
  return { message: `No strategy with id "${id}".` }
}

/** Registered under the /api/atlas prefix. */
export const atlasRouter: FastifyPluginAsync = async app => {
  app.get('/', (): AtlasResponse => ({ strategies: listStrategies() }))

  app.post('/', (req, reply): AtlasStrategy | ApiError => {
    const body = AtlasStrategyInputSchema.safeParse(req.body)
    if (!body.success) return badRequest(reply, body.error)
    reply.code(201)
    return createStrategy(body.data)
  })

  app.put('/:id', (req, reply): AtlasStrategy | ApiError => {
    const params = AtlasStrategyParamsSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error)
    const body = AtlasStrategyInputSchema.safeParse(req.body)
    if (!body.success) return badRequest(reply, body.error)
    return updateStrategy(params.data.id, body.data) ?? notFound(reply, params.data.id)
  })

  app.delete('/:id', (req, reply): ApiError | FastifyReply => {
    const params = AtlasStrategyParamsSchema.safeParse(req.params)
    if (!params.success) return badRequest(reply, params.error)
    if (!deleteStrategy(params.data.id)) return notFound(reply, params.data.id)
    // No body on success — send explicitly; returning undefined would hang the request.
    return reply.code(204).send()
  })
}
