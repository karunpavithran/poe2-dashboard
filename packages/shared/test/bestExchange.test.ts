import { describe, expect, it } from 'vitest'

import { computeBestExchange } from '../src/bestExchange.js'
import { buildGraph } from '../src/graph.js'
import type { ExchangeType, HubNames, RateEdge } from '../src/index.js'

const edge = (
  from: string,
  to: string,
  rate: number,
  volume = 100,
  category: ExchangeType = 'Currency',
): RateEdge => ({ from, to, rate, volume, category })

const HUBS: HubNames = { divine: 'Div', exalted: 'Exa', chaos: 'Cha' }
// 1 Div = 100 Exa = 1000 Cha (Div worth 1, Exa 0.01, Cha 0.001).
const VALUES: Record<string, number> = { Div: 1, Exa: 0.01, Cha: 0.001 }

describe('computeBestExchange', () => {
  it('prices a direct hub->currency buy in Divine terms', () => {
    // 1 Cha buys 2 X, so acquiring 1 X costs 0.5 Cha = 0.0005 Div.
    const graph = buildGraph([edge('Cha', 'X', 2)])
    const { bestBuy } = computeBestExchange(graph, VALUES, HUBS)
    expect(bestBuy.X!.chaos).toBeCloseTo(0.0005)
    // No observed Div->X or Exa->X, and no hub route to compose one.
    expect(bestBuy.X!.divine).toBeNull()
    expect(bestBuy.X!.exalted).toBeNull()
  })

  it('composes a two-leg buy route through another hub', () => {
    // Only Cha->X is observed, but Div->Cha and Exa->Cha let us route in.
    const graph = buildGraph([
      edge('Cha', 'X', 2),
      edge('Div', 'Cha', 1000), // 1 Div -> 1000 Cha
      edge('Exa', 'Cha', 10), // 1 Exa -> 10 Cha
    ])
    const { bestBuy } = computeBestExchange(graph, VALUES, HUBS)
    // Div->Cha->X: 1 Div -> 1000 Cha -> 2000 X, so 1 X costs 1/2000 Div.
    expect(bestBuy.X!.divine).toBeCloseTo(1 / 2000)
    // Exa->Cha->X: 1 Exa -> 10 Cha -> 20 X; 1 X = 0.05 Exa = 0.0005 Div.
    expect(bestBuy.X!.exalted).toBeCloseTo(0.0005)
  })

  it('values a sell into each hub in Divine terms and keeps directions independent', () => {
    // Sell side is the well-populated one: X lists outbound rates to every hub.
    const graph = buildGraph([
      edge('X', 'Div', 0.0004), // 1 X -> 0.0004 Div
      edge('X', 'Cha', 0.45), // 1 X -> 0.45 Cha = 0.00045 Div (best)
    ])
    const { bestBuy, bestSell } = computeBestExchange(graph, VALUES, HUBS)
    expect(bestSell.X!.divine).toBeCloseTo(0.0004)
    expect(bestSell.X!.chaos).toBeCloseTo(0.00045)
    expect(bestSell.X!.exalted).toBeNull()
    // Buy direction is unobserved here, so it stays absent (never inverted).
    expect(bestBuy.X!.divine).toBeNull()
  })

  it('picks the better of a direct edge and a composed route', () => {
    const graph = buildGraph([
      edge('Div', 'X', 100), // direct: 1 Div -> 100 X
      edge('Div', 'Cha', 1000),
      edge('Cha', 'X', 0.2), // composed: 1 Div -> 1000 Cha -> 200 X (better)
    ])
    const { bestBuy } = computeBestExchange(graph, VALUES, HUBS)
    // Best route yields 200 X per Div, so 1 X costs 1/200 Div.
    expect(bestBuy.X!.divine).toBeCloseTo(1 / 200)
  })

  it('skips a hub with no usable Divine value', () => {
    const graph = buildGraph([edge('Cha', 'X', 2)])
    const { bestBuy } = computeBestExchange(graph, { Div: 1, Exa: 0.01, Cha: 0 }, HUBS)
    expect(bestBuy.X!.chaos).toBeNull()
  })
})
