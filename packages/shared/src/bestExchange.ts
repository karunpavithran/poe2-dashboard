import type { BestExchangeMap, HubNames, HubPrices } from './domain.js'
import type { RateGraph } from './graph.js'
import { HUB_KEYS } from './schemas.js'

/**
 * For a picked currency, "which of Divine/Exalted/Chaos is the best hub to buy it
 * in (or sell it into)?" — the same rate graph arbitrage walks, but a shorter
 * walk. This is *not* cycle detection: for each currency X and each hub H it finds
 * the best honest route H->X (buy) and X->H (sell) and expresses it in Divine Orbs
 * so the three hubs are directly comparable.
 *
 * Honesty rules, matching buildEdges: observed edges only, never inverted. A route
 * is at most two legs, and any intermediate must be one of the other two hubs —
 * the natural money path a player would actually take (e.g. Exalted->Chaos->X when
 * X only has a Chaos market). Restricting intermediates to hubs also keeps this at
 * O(currencies * hubs^2) and keeps every route interpretable.
 *
 * Because both directions come from independently observed markets, bestBuy[X][h]
 * (Divine paid) normally sits above bestSell[X][h] (Divine received) by the real
 * spread — the same asymmetry that makes cross-hub differences meaningful.
 */

/**
 * Units of `to` per 1 `from` along the best route of at most two legs, where any
 * intermediate is restricted to `hubNames`. `null` when no observed route exists.
 * A currency trivially converts to itself at 1.
 */
const bestRate = (
  graph: RateGraph,
  from: string,
  to: string,
  hubNames: readonly string[],
): number | null => {
  if (from === to) return 1
  let best: number | null = null

  const direct = graph.get(from)?.get(to)?.rate
  if (direct !== undefined && direct > 0) best = direct

  for (const mid of hubNames) {
    if (mid === from || mid === to) continue
    const first = graph.get(from)?.get(mid)?.rate
    const second = graph.get(mid)?.get(to)?.rate
    if (first !== undefined && first > 0 && second !== undefined && second > 0) {
      const product = first * second
      if (best === null || product > best) best = product
    }
  }

  return best
}

/** Every currency that appears as either endpoint of an observed edge. */
const collectCurrencies = (graph: RateGraph): Set<string> => {
  const currencies = new Set<string>()
  for (const [from, outgoing] of graph) {
    currencies.add(from)
    for (const to of outgoing.keys()) currencies.add(to)
  }
  return currencies
}

/**
 * Builds the per-currency buy/sell hub comparisons for the Exchanges "Rates" tab.
 * `values` maps each currency to its Divine value (Divine Orb itself = 1); `hubs`
 * carries the three anchor hubs' display names as they appear in the graph.
 */
export const computeBestExchange = (
  graph: RateGraph,
  values: Record<string, number>,
  hubs: HubNames,
): { bestBuy: BestExchangeMap; bestSell: BestExchangeMap } => {
  const hubNames = HUB_KEYS.map(key => hubs[key])
  const bestBuy: BestExchangeMap = {}
  const bestSell: BestExchangeMap = {}

  for (const currency of collectCurrencies(graph)) {
    const buy: HubPrices = { divine: null, exalted: null, chaos: null }
    const sell: HubPrices = { divine: null, exalted: null, chaos: null }

    for (const key of HUB_KEYS) {
      const hubName = hubs[key]
      const hubValue = values[hubName]
      // Without the hub's Divine value we can't normalize into a comparable unit.
      if (!hubValue || hubValue <= 0) continue

      // Buy: route hub -> currency gives `currency` per 1 hub; invert to Divine paid.
      const perHub = bestRate(graph, hubName, currency, hubNames)
      if (perHub !== null && perHub > 0) buy[key] = hubValue / perHub

      // Sell: route currency -> hub gives `hub` per 1 currency; value it in Divine.
      const hubPer = bestRate(graph, currency, hubName, hubNames)
      if (hubPer !== null && hubPer > 0) sell[key] = hubPer * hubValue
    }

    bestBuy[currency] = buy
    bestSell[currency] = sell
  }

  return { bestBuy, bestSell }
}
