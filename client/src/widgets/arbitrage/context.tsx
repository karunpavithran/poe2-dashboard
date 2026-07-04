import type { ArbitrageFilters, ExchangeType } from '@poe2-dashboard/shared'
import {
  ArbitrageFilterSchema,
  arbitrageFiltersToParams,
  EXCHANGE_TYPES,
} from '@poe2-dashboard/shared'
import type { SortingState } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useArbitragesQuery } from '@/api.js'

type ArbitrageContextValue = {
  minProfit: number
  minVolume: number
  setMinProfit: (value: number) => void
  setMinVolume: (value: number) => void
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
  // The three filters live in the URL query string so a filtered view is
  // shareable/bookmarkable and browser back/forward move through it —
  // useSearchParams is the single source of truth. The setters rewrite the query
  // with `replace` so tweaking a threshold doesn't pile up history entries.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(
    () => ArbitrageFilterSchema.parse(Object.fromEntries(searchParams)),
    [searchParams],
  )
  const { minProfit, minVolume } = filters
  const selectedCategories = useMemo(() => new Set(filters.categories), [filters.categories])

  // Rewrite the query from a mutated copy of the current filters. Defaults are
  // omitted (arbitrageFiltersToParams), so the default view carries no params.
  const updateFilters = useCallback(
    (patch: Partial<ArbitrageFilters>) =>
      setSearchParams(arbitrageFiltersToParams({ ...filters, ...patch }), { replace: true }),
    [filters, setSearchParams],
  )
  const setMinProfit = useCallback(
    (value: number) => updateFilters({ minProfit: value }),
    [updateFilters],
  )
  const setMinVolume = useCallback(
    (value: number) => updateFilters({ minVolume: value }),
    [updateFilters],
  )
  const toggleCategory = useCallback(
    (category: ExchangeType) => {
      const next = new Set(selectedCategories)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      updateFilters({ categories: [...next] })
    },
    [selectedCategories, updateFilters],
  )
  // Clearing every param restores all defaults (all categories, default thresholds).
  const resetFilters = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams])

  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null)
  // Default to highest profit/day (throughput) first.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'throughput', desc: true }])

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
