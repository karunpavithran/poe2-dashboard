import type { ExchangeType, HubNames, RateEdge } from './domain.js'
import { EXCHANGE_TYPES } from './schemas.js'

/**
 * Maps each currency to the exchange categories it's *listed in* — the pages
 * where it's the non-hub side of a trade (an Essence is listed on the Essences
 * page, etc.). Drives the Currency Explorer's category filter.
 *
 * The three anchor hubs (Divine/Exalted/Chaos) appear on every category page, so
 * attributing categories to them is meaningless; they're excluded here and the
 * UI shows them regardless of the active filter. A currency can land in more than
 * one category if it's genuinely listed on multiple pages.
 *
 * Derived straight from edges (each `RateEdge` carries the `category` of the page
 * it came from), so it needs no separate graph walk.
 */
export const computeCurrencyCategories = (
  edges: RateEdge[],
  hubs: HubNames,
): Record<string, ExchangeType[]> => {
  const hubNames = new Set(Object.values(hubs))
  const byCurrency = new Map<string, Set<ExchangeType>>()

  const attribute = (currency: string, category: ExchangeType) => {
    if (hubNames.has(currency)) return
    let set = byCurrency.get(currency)
    if (!set) {
      set = new Set()
      byCurrency.set(currency, set)
    }
    set.add(category)
  }

  for (const edge of edges) {
    attribute(edge.from, edge.category)
    attribute(edge.to, edge.category)
  }

  // Emit each currency's categories in the canonical EXCHANGE_TYPES order so the
  // output is stable across polls (edge iteration order is not).
  const result: Record<string, ExchangeType[]> = {}
  for (const [currency, set] of byCurrency) {
    result[currency] = EXCHANGE_TYPES.filter(type => set.has(type))
  }
  return result
}
