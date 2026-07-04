import { DEFAULT_MIN_PROFIT, DEFAULT_MIN_VOLUME, EXCHANGE_TYPES } from '@poe2-dashboard/shared'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { CategoryFilter } from './CategoryFilter.js'
import { useArbitrageContext } from './context.js'

type ThresholdFieldProps = {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
}

// A labelled number input. Lives in the toolbar now (not the column headers), so
// the table headers can stay single-line sort labels with no alignment fuss.
const ThresholdField = ({ id, label, value, onChange, suffix }: ThresholdFieldProps) => (
  <div className="flex items-center gap-2">
    <label htmlFor={id} className="whitespace-nowrap text-xs text-muted-foreground">
      {label}
    </label>
    <div className="relative">
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={cn(
          'h-7 w-20 rounded-md px-2 text-right text-sm tabular-nums [appearance:textfield]',
          '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          suffix && 'pr-5',
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  </div>
)

/**
 * Collapsible filter bar above the table. Collapsed (default) it's a single row:
 * a "Filters" toggle, a one-line summary of the active thresholds + category
 * count, and a Reset shown only when something is off-default. Expanded, it
 * reveals the threshold inputs and the category chips. This keeps the chips and
 * inputs off the persistent surface — reclaiming the vertical space they used to
 * eat — while leaving full control one click away.
 */
export const FilterToolbar = () => {
  const { minProfit, setMinProfit, minVolume, setMinVolume, selectedCategories, resetFilters } =
    useArbitrageContext()
  const [expanded, setExpanded] = useState(false)

  const categoryCount = selectedCategories.size
  const totalCategories = EXCHANGE_TYPES.length
  const isDefault =
    minProfit === DEFAULT_MIN_PROFIT &&
    minVolume === DEFAULT_MIN_VOLUME &&
    categoryCount === totalCategories

  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <div className="rounded-md border border-border bg-card/40">
      <div className="flex items-center gap-3 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-expanded={expanded}
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <Chevron className="h-4 w-4 text-muted-foreground" />
          Filters
        </button>
        {!expanded && (
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            profit ≥{minProfit}% · vol ≥{minVolume} · {categoryCount}/{totalCategories} categories
          </span>
        )}
        {!isDefault && (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-2 py-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <ThresholdField
              id="min-profit"
              label="Min profit"
              value={minProfit}
              onChange={setMinProfit}
              suffix="%"
            />
            <ThresholdField
              id="min-volume"
              label="Min volume"
              value={minVolume}
              onChange={setMinVolume}
            />
          </div>
          <CategoryFilter />
        </div>
      )}
    </div>
  )
}
