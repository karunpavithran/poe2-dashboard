import { useState } from 'react'

import { useRefreshStreams, useStreams } from '@/api.js'
import { DataAge } from '@/components/common/DataAge.js'
import { TagChip } from '@/components/common/TagChip.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const StreamWidget = () => {
  const { streams, isStreamsFetching } = useStreams()
  const refresh = useRefreshStreams()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const { softcoreStreams, tags, fetchedAt, lastError } = streams
  const displayedStreams = selectedTag
    ? (tags.find(t => t.tag.toLowerCase() === selectedTag)?.items ?? softcoreStreams)
    : softcoreStreams

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <CardTitle>Live PoE2 Streams</CardTitle>
        {fetchedAt && (
          <DataAge
            fetchedAt={fetchedAt}
            onRefetch={() => refresh.mutate()}
            isFetching={refresh.isPending || isStreamsFetching}
          />
        )}
      </CardHeader>
      <CardContent>
        {lastError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-sm mb-3">
            Twitch unavailable: {lastError}
          </p>
        )}

        {tags.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">
              {selectedTag
                ? `Filtered by "${selectedTag}" — click again to clear`
                : 'Build & content tags'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(entry => (
                <TagChip
                  key={entry.tag}
                  entry={entry}
                  active={selectedTag === entry.tag.toLowerCase()}
                  onClick={() =>
                    setSelectedTag(prev =>
                      prev === entry.tag.toLowerCase() ? null : entry.tag.toLowerCase(),
                    )
                  }
                  renderItem={s => (
                    <a
                      key={s.userId}
                      className="flex justify-between items-center gap-4 px-3 py-1 text-muted-foreground text-xs no-underline hover:bg-accent hover:text-foreground"
                      href={`https://twitch.tv/${s.userName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{s.userName}</span>
                      <span className="text-green-400 tabular-nums">
                        {s.viewerCount.toLocaleString()}
                      </span>
                    </a>
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {softcoreStreams.length === 0 && !lastError && (
          <p className="text-muted-foreground py-4">No live softcore PoE2 streams found.</p>
        )}

        {displayedStreams.length > 0 && (
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-card w-8">#</TableHead>
                  <TableHead className="sticky top-0 bg-card">Streamer</TableHead>
                  <TableHead className="sticky top-0 bg-card">Viewers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedStreams.map((s, i) => (
                  <TableRow key={s.userId}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell>
                      <a
                        className="text-violet-400 hover:underline"
                        href={`https://twitch.tv/${s.userName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.title}
                      >
                        {s.userName}
                      </a>
                    </TableCell>
                    <TableCell className="text-green-400 tabular-nums whitespace-nowrap">
                      {s.viewerCount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
