import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useState } from 'react'

import { useBuildTrends } from '@/api.js'
import { DataAge } from '@/components/common/DataAge.js'
import { SectionLabel, sectionLabelClass } from '@/components/common/SectionLabel.js'
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
import { ascendancyIconUrl } from '@/lib/ascendancyIcons.js'

const TrendArrow = ({ trend }: { trend: 1 | 0 | -1 }) => {
  if (trend === 1) return <ArrowUp size={14} className="text-green-400" />
  if (trend === -1) return <ArrowDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-muted-foreground" />
}

export const TrendsWidget = () => {
  const {
    buildTrends: {
      softcoreStreams,
      tags,
      fetchedAt,
      lastError,
      ninjaError,
      ascendancies,
      mainSkills,
    },
    refetchBuildTrends,
    isBuildTrendsFetching,
  } = useBuildTrends()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const displayedTags = selectedTag ? tags.filter(t => t.tag.toLowerCase() === selectedTag) : tags
  const displayedStreams = selectedTag
    ? (tags.find(t => t.tag.toLowerCase() === selectedTag)?.items ?? softcoreStreams)
    : softcoreStreams

  const handleTagClick = (entry: { tag: string }) => {
    const key = entry.tag.toLowerCase()
    setSelectedTag(prev => (prev === key ? null : key))
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-3">
        <CardTitle>Meta Trends</CardTitle>
        <DataAge
          fetchedAt={fetchedAt}
          onRefetch={refetchBuildTrends}
          isFetching={isBuildTrendsFetching}
        />
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
          <div className="flex flex-col min-h-0">
            <SectionLabel className="mb-2">Live streams</SectionLabel>
            {lastError && <p className="text-destructive text-xs mb-2">{lastError}</p>}
            {softcoreStreams.length === 0 && !lastError && (
              <p className="text-muted-foreground text-xs">No live softcore streams.</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {displayedTags.map(entry => (
                  <TagChip
                    key={entry.tag}
                    entry={entry}
                    active={selectedTag === entry.tag.toLowerCase()}
                    onClick={() => handleTagClick(entry)}
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
            )}

            {displayedStreams.length > 0 && (
              <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`sticky top-0 bg-card z-10 w-8 ${sectionLabelClass}`}>
                        #
                      </TableHead>
                      <TableHead className={`sticky top-0 bg-card z-10 ${sectionLabelClass}`}>
                        Streamer
                      </TableHead>
                      <TableHead className={`sticky top-0 bg-card z-10 ${sectionLabelClass}`}>
                        Viewers
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedStreams.map((stream, i) => (
                      <TableRow key={stream.userId}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <a
                            className="text-violet-400 hover:underline"
                            href={`https://twitch.tv/${stream.userName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={stream.title}
                          >
                            {stream.userName}
                          </a>
                        </TableCell>
                        <TableCell className="text-green-400 tabular-nums whitespace-nowrap">
                          {stream.viewerCount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto">
            <SectionLabel className="mb-2">Ascendancy share</SectionLabel>
            {ninjaError && ascendancies.length === 0 && (
              <p className="text-muted-foreground text-xs">{ninjaError}</p>
            )}
            {ascendancies.length === 0 && !ninjaError && (
              <p className="text-muted-foreground text-xs">No data yet.</p>
            )}
            <ul className="space-y-1">
              {ascendancies.map(a => (
                <li key={a.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <img
                      src={ascendancyIconUrl(a.name)}
                      alt={a.name}
                      className="w-6 h-6 object-contain shrink-0"
                      onError={e => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    {a.name}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                    {a.pct.toFixed(1)}%
                    <TrendArrow trend={a.trend} />
                  </span>
                </li>
              ))}
            </ul>
            {mainSkills.length > 0 && (
              <div className="mt-4">
                <SectionLabel className="mb-2">Main skills</SectionLabel>
                <ul className="space-y-1">
                  {mainSkills.map(skill => (
                    <li key={skill.name} className="flex items-center justify-between text-sm">
                      <span>{skill.name}</span>
                      <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                        {skill.pct.toFixed(1)}%
                        <TrendArrow trend={skill.trend} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
