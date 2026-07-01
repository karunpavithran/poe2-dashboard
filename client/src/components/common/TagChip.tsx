import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type TagEntry<T> = {
  tag: string
  viewers: number
  items: T[]
}

type TagChipProps<T> = {
  entry: TagEntry<T>
  active: boolean
  onClick: () => void
  renderItem: (item: T) => ReactNode
}

const formatViewers = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export const TagChip = <T,>({ entry, active, onClick, renderItem }: TagChipProps<T>) => (
  <div className="group/tag relative inline-flex">
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs cursor-pointer select-none transition-colors',
        active
          ? 'border-indigo-500 bg-indigo-950/60 shadow-[0_0_0_1px_theme(colors.indigo.500)]'
          : 'border-border bg-secondary hover:border-primary/50',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <span className="text-foreground">{entry.tag}</span>
      <span className="text-green-400 tabular-nums">{formatViewers(entry.viewers)}</span>
    </div>
    <div className="hidden group-hover/tag:block absolute top-full left-0 mt-1.5 z-50 min-w-44 bg-popover border border-border rounded-md py-1 shadow-lg">
      {entry.items.map(renderItem)}
    </div>
  </div>
)
