import type { Arbitrage, ExchangeType } from '@poe2-dashboard/shared'

export type ArbitrageFilters = {
  /** Drop cycles whose worst leg has volume below this. */
  minVolume?: number
  /** Drop cycles paying less than this percent. */
  minProfitPct?: number
  /**
   * Keep only cycles whose every leg comes from one of these categories.
   * Undefined means no category filtering (all categories allowed).
   */
  categories?: Set<ExchangeType>
}

export const applyFilters = (
  arbitrages: Arbitrage[],
  { minVolume = 0, minProfitPct = 0, categories }: ArbitrageFilters,
): Arbitrage[] =>
  arbitrages.filter(
    o =>
      o.minVolume >= minVolume &&
      o.profitPct >= minProfitPct &&
      (categories === undefined || o.legs.every(leg => categories.has(leg.category))),
  )
