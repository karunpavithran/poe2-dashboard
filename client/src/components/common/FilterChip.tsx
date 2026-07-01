import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type FilterChipProps = {
  active: boolean
  onClick: () => void
  children: ReactNode
}

// The toggleable pill used by every filter chip strip (arbitrage categories,
// atlas tags). One look, one behaviour: indigo when active, muted otherwise.
export const FilterChip = ({ active, onClick, children }: FilterChipProps) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'rounded-full border px-2.5 py-0.5 text-xs select-none transition-colors',
      active
        ? 'border-indigo-500 bg-indigo-950/60 text-foreground shadow-[0_0_0_1px_theme(colors.indigo.500)]'
        : 'border-border bg-secondary text-muted-foreground hover:border-primary/50',
    )}
  >
    {children}
  </button>
)
