import type { TwitchStream } from '@poe2-dashboard/shared'

import type { TagEntry } from '@/components/common/TagChip.js'

const EXCLUDED = /\b(SSF|Hardcore|HC)\b/i

export const isSoftcore = (stream: TwitchStream): boolean => !EXCLUDED.test(stream.title)

export const extractTags = (streams: TwitchStream[]): TagEntry<TwitchStream>[] => {
  const softcoreStreams = streams.filter(isSoftcore)
  const byTag = softcoreStreams.reduce<Record<string, TagEntry<TwitchStream>>>((tagMap, stream) => {
    for (const tag of stream.tags) {
      const key = tag.toLowerCase()
      if (tagMap[key]) {
        tagMap[key].viewers += stream.viewerCount
        tagMap[key].items.push(stream)
      } else {
        tagMap[key] = { tag, viewers: stream.viewerCount, items: [stream] }
      }
    }
    return tagMap
  }, {})

  return Object.values(byTag).sort((a, b) => b.viewers - a.viewers)
}
