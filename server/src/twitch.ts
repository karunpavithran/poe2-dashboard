import type { StreamsResponse, TwitchStream } from '@poe2-dashboard/shared'
import { z } from 'zod'

import { tagStreams } from './twitchTags.js'

const POLL_INTERVAL_MS = 30 * 60 * 1000

interface AppToken {
  accessToken: string
  expiresAt: number
}

export type TwitchPollerState = {
  streams: TwitchStream[]
  fetchedAt: number | null
  lastError: string | null
}

const AppTokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
})

const TwitchGameRawSchema = z.object({ id: z.string(), name: z.string() })
const TwitchGamesResponseSchema = z.object({ data: z.array(TwitchGameRawSchema) })

const TwitchStreamRawSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  title: z.string(),
  viewer_count: z.number(),
  started_at: z.string(),
  tags: z.array(z.string()).catch([]),
})
const TwitchStreamsResponseSchema = z.object({ data: z.array(TwitchStreamRawSchema) })

const fetchAppToken = async (clientId: string, clientSecret: string): Promise<AppToken> => {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`)
  const data = AppTokenSchema.parse(await res.json())
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  }
}

const fetchGameId = async (clientId: string, token: string): Promise<string> => {
  const url = 'https://api.twitch.tv/helix/games?name=Path+of+Exile+2'
  const res = await fetch(url, {
    headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Twitch game lookup failed: ${res.status}`)
  const data = TwitchGamesResponseSchema.parse(await res.json())
  const game = data.data[0]
  if (!game) throw new Error('Path of Exile 2 not found in Twitch game catalog')
  return game.id
}

const fetchTopStreams = async (
  clientId: string,
  token: string,
  gameId: string,
): Promise<TwitchStream[]> => {
  const url = `https://api.twitch.tv/helix/streams?game_id=${gameId}&first=25`
  const res = await fetch(url, {
    headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Twitch streams fetch failed: ${res.status}`)
  const data = TwitchStreamsResponseSchema.parse(await res.json())
  return data.data.map(s => ({
    userId: s.user_id,
    userName: s.user_name,
    title: s.title,
    viewerCount: s.viewer_count,
    startedAt: s.started_at,
    tags: s.tags,
  }))
}

export type TwitchPollerOptions = {
  clientId: string
  clientSecret: string
}

export const createTwitchPoller = (options: TwitchPollerOptions) => {
  const state: TwitchPollerState = {
    streams: [],
    fetchedAt: null,
    lastError: null,
  }

  if (!options.clientId || !options.clientSecret) {
    state.lastError = 'TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured'
    return { state, start: () => {}, stop: () => {} }
  }

  let token: AppToken | null = null
  let gameId: string | null = null

  const getToken = async (): Promise<string> => {
    if (!token || Date.now() >= token.expiresAt) {
      token = await fetchAppToken(options.clientId, options.clientSecret)
    }
    return token.accessToken
  }

  const pollOnce = async (): Promise<void> => {
    try {
      const accessToken = await getToken()
      if (!gameId) {
        gameId = await fetchGameId(options.clientId, accessToken)
        console.log(`[twitch] PoE2 game_id = ${gameId}`)
      }
      const raw = await fetchTopStreams(options.clientId, accessToken, gameId)
      state.streams = await tagStreams(raw)
      state.fetchedAt = Date.now()
      state.lastError = null
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err)
      console.error(`[twitch] poll failed: ${state.lastError}`)
    }
  }

  let timer: NodeJS.Timeout | null = null

  const scheduleTick = (): void => {
    void pollOnce().then(() => {
      timer = setTimeout(scheduleTick, POLL_INTERVAL_MS)
    })
  }

  return {
    state,
    start: scheduleTick,
    stop: () => {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

export const toStreamsResponse = (state: TwitchPollerState): StreamsResponse => ({
  streams: state.streams,
  fetchedAt: state.fetchedAt,
  lastError: state.lastError,
})
