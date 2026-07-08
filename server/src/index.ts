import { createPoller } from './poller.js'
import { createServer } from './server.js'
import { createTwitchPoller } from './twitch.js'

const league = process.env.LEAGUE ?? 'Runes of Aldur'
const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 60 * 60 * 1000)
const port = Number(process.env.PORT ?? 3000)

const poller = createPoller({ league, intervalMs })
poller.start()

const twitchPoller = createTwitchPoller({
  clientId: process.env.TWITCH_CLIENT_ID ?? '',
  clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
})
twitchPoller.start()

const app = await createServer(
  poller.state,
  league,
  twitchPoller.state,
  () => void poller.pollOnce(),
)

app.listen({ port, host: '127.0.0.1' }).catch(err => {
  console.error(err)
  process.exit(1)
})
