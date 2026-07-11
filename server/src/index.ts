import { runMigrations } from './db/client.js'
import { createPoller } from './poller.js'
import { createServer } from './server.js'
import { createTwitchFetcher } from './twitch.js'

const league = process.env.LEAGUE ?? 'Runes of Aldur'
const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 60 * 60 * 1000)
const port = Number(process.env.PORT ?? 3000)
// Loopback-only by default; the Docker image sets HOST=0.0.0.0 so the mapped
// port is reachable from outside the container.
const host = process.env.HOST ?? '127.0.0.1'
const clientDist = process.env.CLIENT_DIST

// Bring the DB up to date before anything can touch it. Synchronous: routes
// aren't registered and pollers aren't started until the schema is current.
runMigrations()

const poller = createPoller({ league, intervalMs })
poller.start()

// Lazy: no Twitch (or Claude tagging) call happens here — the fetcher restores
// the persisted snapshot and only hits upstream on the first-ever request or an
// explicit POST /api/streams/refresh.
const twitch = createTwitchFetcher({
  clientId: process.env.TWITCH_CLIENT_ID ?? '',
  clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
})

const app = await createServer(
  poller.state,
  league,
  twitch,
  () => void poller.pollOnce(),
  clientDist,
)

app.listen({ port, host }).catch(err => {
  console.error(err)
  process.exit(1)
})
