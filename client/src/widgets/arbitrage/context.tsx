import type { ExchangeType } from '@poe2-dashboard/shared'
import { EXCHANGE_TYPES } from '@poe2-dashboard/shared'
import type { SortingState } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { createContext, useContext, useMemo, useState } from 'react'

import { useArbitragesQuery } from '@/api.js'

/** Filter defaults — also the baseline the toolbar compares against to show "active". */
export const DEFAULT_MIN_PROFIT = 250
export const DEFAULT_MIN_VOLUME = 10

type ArbitrageContextValue = {
  minProfit: number
  minVolume: number
  setMinProfit: React.Dispatch<React.SetStateAction<number>>
  setMinVolume: React.Dispatch<React.SetStateAction<number>>
  /** Categories currently included in the arbitrage search. */
  selectedCategories: Set<ExchangeType>
  toggleCategory: (category: ExchangeType) => void
  /** Restore every filter (thresholds + categories) to its default. */
  resetFilters: () => void
  /** The cycle (by `cycleKey`) loaded into the payoff calculator, or null when none is selected. */
  selectedCycleKey: string | null
  setSelectedCycleKey: React.Dispatch<React.SetStateAction<string | null>>
  /**
   * TanStack Table sorting state for the arbitrage table. Held here (not in the
   * table component) so it survives navigating away from the widget and back —
   * the table unmounts on view switch, the provider doesn't.
   */
  sorting: SortingState
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
}

const ArbitrageContext = createContext<ArbitrageContextValue | null>(null)

export const ArbitrageProvider = ({ children }: { children: ReactNode }) => {
  const [minProfit, setMinProfit] = useState(DEFAULT_MIN_PROFIT)
  const [minVolume, setMinVolume] = useState(DEFAULT_MIN_VOLUME)
  const [selectedCategories, setSelectedCategories] = useState<Set<ExchangeType>>(
    () => new Set<ExchangeType>(EXCHANGE_TYPES),
  )
  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null)
  // Default to highest profit/day (throughput) first.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'throughput', desc: true }])

  const toggleCategory = (category: ExchangeType) =>
    setSelectedCategories(current => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })

  const resetFilters = () => {
    setMinProfit(DEFAULT_MIN_PROFIT)
    setMinVolume(DEFAULT_MIN_VOLUME)
    setSelectedCategories(new Set<ExchangeType>(EXCHANGE_TYPES))
  }

  return (
    <ArbitrageContext.Provider
      value={{
        minProfit,
        minVolume,
        setMinProfit,
        setMinVolume,
        selectedCategories,
        toggleCategory,
        resetFilters,
        selectedCycleKey,
        setSelectedCycleKey,
        sorting,
        setSorting,
      }}
    >
      {children}
    </ArbitrageContext.Provider>
  )
}

export const useArbitrageContext = (): ArbitrageContextValue => {
  const ctx = useContext(ArbitrageContext)
  if (!ctx) throw new Error('useArbitrageContext must be used within ArbitrageProvider')
  return ctx
}

// All filtering is done client-side, never in the query key: the server returns
// arbitrages across every category with no thresholds applied, so its result is a
// superset of any filter combination. We fetch that superset once and re-filter the
// cached rows here, so adjusting minProfit/minVolume or toggling a category never
// triggers a refetch — only the first mount (and the hourly background refresh) hit
// the network. The filter mirrors the server's applyFilters: a cycle survives only
// if it clears both thresholds and every leg's category is still selected. Row
// *ordering* is left to TanStack Table in ArbitrageTable; the payoff calculator
// only looks rows up by key, so it doesn't care about order.
export const useArbitrages = () => {
  const { minProfit, minVolume, selectedCategories } = useArbitrageContext()
  const { arbitrages: snapshot, ...rest } = useArbitragesQuery()

  const allSelected = useMemo(
    () => selectedCategories.size === EXCHANGE_TYPES.length,
    [selectedCategories],
  )
  const arbitrages = useMemo(
    () => ({
      ...snapshot,
      arbitrages: snapshot.arbitrages.filter(
        o =>
          o.profitPct >= minProfit &&
          o.minVolume >= minVolume &&
          (allSelected || o.legs.every(leg => selectedCategories.has(leg.category))),
      ),
    }),
    [snapshot, minProfit, minVolume, allSelected, selectedCategories],
  )

  return { arbitrages, ...rest }
}
