import Anthropic from '@anthropic-ai/sdk'
import type { TwitchStream } from '@poe2-dashboard/shared'
import { z } from 'zod'

const client = new Anthropic()

const TagMapSchema = z.record(z.string(), z.array(z.string()))

const SYSTEM_PROMPT =
  'You are a Path of Exile 2 expert. Given a list of Twitch stream titles, extract tags describing what the streamer is doing. ' +
  'Tags should cover two categories:\n' +
  '1. Build: the main skill gem or archetype (e.g. "Lightning Arrow", "Spark", "Ball Lightning", "Boneshatter", "Deadeye", "Invoker").\n' +
  '2. League content: the endgame content or league mechanic being focused on (e.g. "Breach", "Ritual", "Delirium", "Ultimatum", "Expedition", "Settlers", "Mapping", "Bossing", "Pinnacle").\n' +
  'Return ONLY a JSON object mapping each stream index (as a string key) to an array of 1-4 tag strings covering whichever categories are identifiable. ' +
  'If you cannot determine either for a title, return an empty array for that index. No explanation, no markdown fences — raw JSON only.'

export const tagStreams = async (streams: TwitchStream[]): Promise<TwitchStream[]> => {
  if (!process.env.ANTHROPIC_API_KEY || streams.length === 0) return streams

  const titlesText = streams.map((s, i) => `${i}: ${s.title}`).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: titlesText }],
    })

    const block = message.content[0]
    if (block?.type !== 'text') return streams

    const jsonMatch = block.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return streams

    const parsed = TagMapSchema.safeParse(JSON.parse(jsonMatch[0]))
    if (!parsed.success) return streams

    return streams.map((s, i) => ({ ...s, tags: parsed.data[String(i)] ?? [] }))
  } catch (err) {
    console.warn('[twitchTags] tagging failed, returning untagged streams:', err)
    return streams
  }
}
