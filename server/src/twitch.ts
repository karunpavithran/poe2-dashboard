import type { StreamsResponse, TwitchStream } from '@poe2-dashboard/shared'
import { z } from 'zod'

import { loadTwitchSnapshot, saveTwitchSnapshot } from './slices/twitch/twitch.service.js'
import { tagStreams } from './twitchTags.js'

interface AppToken {
  accessToken: string
  expiresAt: number
}

export type TwitchState = {
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

export type TwitchFetcherOptions = {
  clientId: string
  clientSecret: string
}

export type TwitchFetcher = {
  state: TwitchState
  /**
   * Fetch (and tag) streams only if no snapshot exists at all — neither in
   * memory nor restored from the DB. Once a snapshot exists it is served
   * indefinitely; only `refresh` replaces it. So Twitch and the Claude tagging
   * call run at most once ever per explicit user refresh, and never before a
   * client actually requests the data. Concurrent callers share one in-flight
   * fetch.
   */
  ensureFresh: () => Promise<void>
  /** Force a new Twitch fetch + tagging pass, replacing the cached snapshot. */
  refresh: () => Promise<void>
}

export const createTwitchFetcher = (options: TwitchFetcherOptions): TwitchFetcher => {
  const state: TwitchState = {
    streams: [],
    fetchedAt: null,
    lastError: null,
  }

  // Restore the last persisted snapshot so restarts don't re-hit Twitch/Claude.
  const cached = loadTwitchSnapshot()
  if (cached) {
    state.streams = cached.streams
    state.fetchedAt = cached.fetchedAt
    console.log(
      `[twitch] restored ${cached.streams.length} streams from the last snapshot ` +
        `(fetchedAt=${new Date(cached.fetchedAt).toISOString()})`,
    )
  }

  if (!options.clientId || !options.clientSecret) {
    state.lastError = 'TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured'
    const noop = () => Promise.resolve()
    return { state, ensureFresh: noop, refresh: noop }
  }

  let token: AppToken | null = null
  let gameId: string | null = null

  const getToken = async (): Promise<string> => {
    if (!token || Date.now() >= token.expiresAt) {
      token = await fetchAppToken(options.clientId, options.clientSecret)
    }
    return token.accessToken
  }

  const fetchOnce = async (): Promise<void> => {
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
      try {
        saveTwitchSnapshot({ fetchedAt: state.fetchedAt, streams: state.streams })
      } catch (err) {
        // Persistence failing only costs the restart cache; keep serving from memory.
        console.warn(
          `[twitch] could not persist snapshot: ${err instanceof Error ? err.message : err}`,
        )
      }
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err)
      console.error(`[twitch] fetch failed: ${state.lastError}`)
    }
  }

  let inFlight: Promise<void> | null = null

  const refresh = (): Promise<void> => {
    inFlight ??= fetchOnce().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const ensureFresh = (): Promise<void> =>
    state.fetchedAt === null ? refresh() : Promise.resolve()

  return { state, ensureFresh, refresh }
}

export const toStreamsResponse = (state: TwitchState): StreamsResponse => ({
  streams: state.streams,
  fetchedAt: state.fetchedAt,
  lastError: state.lastError,
})
