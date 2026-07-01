import type { ExchangeType, RateEdge } from '@poe2-dashboard/shared'
import { describe, expect, it } from 'vitest'

import { findTriangularArbitrages } from '../src/arbitrage.js'
import { applyFilters } from '../src/filters.js'
import { buildGraph } from '../src/graph.js'

const edge = (
  from: string,
  to: string,
  rate: number,
  volume = 100,
  category: ExchangeType = 'Currency',
): RateEdge => ({
  from,
  to,
  rate,
  volume,
  category,
})

describe('findTriangularArbitrages', () => {
  it('detects a planted 20% arbitrage cycle', () => {
    // A->B->C->A: 2 * 3 * 0.2 = 1.2
    const graph = buildGraph([edge('A', 'B', 2), edge('B', 'C', 3), edge('C', 'A', 0.2)])
    const result = findTriangularArbitrages(graph)

    expect(result).toHaveLength(1)
    expect(result[0]!.cycle).toEqual(['A', 'B', 'C'])
    expect(result[0]!.profitPct).toBeCloseTo(20)
    expect(result[0]!.legs.map(l => `${l.from}>${l.to}`)).toEqual(['A>B', 'B>C', 'C>A'])
  })

  it('reports each cycle once regardless of starting currency', () => {
    // Same cycle reachable from three rotations; must not triple-report.
    const graph = buildGraph([edge('B', 'C', 3), edge('C', 'A', 0.2), edge('A', 'B', 2)])
    expect(findTriangularArbitrages(graph)).toHaveLength(1)
  })

  it('canonicalizes the cycle to start at the lexicographically smallest currency', () => {
    // Z->M->A->Z: 2 * 2 * 0.3 = 1.2; canonical start is A.
    const graph = buildGraph([edge('Z', 'M', 2), edge('M', 'A', 2), edge('A', 'Z', 0.3)])
    const result = findTriangularArbitrages(graph)
    expect(result).toHaveLength(1)
    expect(result[0]!.cycle).toEqual(['A', 'Z', 'M'])
    expect(result[0]!.legs[0]!.from).toBe('A')
  })

  it('finds nothing when rates are fair', () => {
    // Perfectly consistent rates: every cycle multiplies to exactly 1.
    const graph = buildGraph([
      edge('A', 'B', 2),
      edge('B', 'A', 0.5),
      edge('B', 'C', 3),
      edge('C', 'B', 1 / 3),
      edge('A', 'C', 6),
      edge('C', 'A', 1 / 6),
    ])
    expect(findTriangularArbitrages(graph)).toHaveLength(0)
  })

  it('finds nothing when the spread makes round trips lossy', () => {
    // Realistic market: each direction is slightly worse than fair.
    const graph = buildGraph([
      edge('A', 'B', 1.9),
      edge('B', 'A', 0.5),
      edge('B', 'C', 2.9),
      edge('C', 'B', 1 / 3),
      edge('A', 'C', 5.9),
      edge('C', 'A', 1 / 6),
    ])
    expect(findTriangularArbitrages(graph)).toHaveLength(0)
  })

  it('respects the profit threshold', () => {
    // 1.2 multiplier = 20% profit; a 25% threshold should exclude it.
    const graph = buildGraph([edge('A', 'B', 2), edge('B', 'C', 3), edge('C', 'A', 0.2)])
    expect(findTriangularArbitrages(graph, 0.25)).toHaveLength(0)
    expect(findTriangularArbitrages(graph, 0.1)).toHaveLength(1)
  })

  it('treats opposite directions of a triangle as independent trades', () => {
    // Profitable one way only.
    const graph = buildGraph([
      edge('A', 'B', 2),
      edge('B', 'C', 3),
      edge('C', 'A', 0.2), // forward: 1.2
      edge('A', 'C', 4),
      edge('C', 'B', 0.25),
      edge('B', 'A', 0.4), // reverse: 4 * 0.25 * 0.4 = 0.4
    ])
    const result = findTriangularArbitrages(graph)
    expect(result).toHaveLength(1)
    expect(result[0]!.profitPct).toBeCloseTo(20)
  })

  it('ignores edges with non-positive rates', () => {
    const graph = buildGraph([edge('A', 'B', 2), edge('B', 'C', 3), edge('C', 'A', 0)])
    expect(findTriangularArbitrages(graph)).toHaveLength(0)
  })

  it('propagates the bottleneck volume as minVolume', () => {
    const graph = buildGraph([
      edge('A', 'B', 2, 500),
      edge('B', 'C', 3, 7),
      edge('C', 'A', 0.2, 200),
    ])
    expect(findTriangularArbitrages(graph)[0]!.minVolume).toBe(7)
  })
})

describe('applyFilters', () => {
  it('filters by minVolume and minProfitPct', () => {
    const graph = buildGraph([
      edge('A', 'B', 2, 500),
      edge('B', 'C', 3, 7),
      edge('C', 'A', 0.2, 200),
    ])
    const arbitrages = findTriangularArbitrages(graph)

    expect(applyFilters(arbitrages, { minVolume: 10 })).toHaveLength(0)
    expect(applyFilters(arbitrages, { minVolume: 5 })).toHaveLength(1)
    expect(applyFilters(arbitrages, { minProfitPct: 25 })).toHaveLength(0)
    expect(applyFilters(arbitrages, { minProfitPct: 15 })).toHaveLength(1)
  })

  it('keeps a cross-category cycle only when every leg category is selected', () => {
    // A cross-category cycle: one leg comes from Runes, the rest from Currency.
    const graph = buildGraph([
      edge('A', 'B', 2, 100, 'Runes'),
      edge('B', 'C', 3, 100, 'Currency'),
      edge('C', 'A', 0.2, 100, 'Currency'),
    ])
    const arbitrages = findTriangularArbitrages(graph)
    expect(arbitrages).toHaveLength(1)

    // Both categories selected → kept.
    expect(applyFilters(arbitrages, { categories: new Set(['Currency', 'Runes']) })).toHaveLength(1)
    // Drop the category the cross-leg needs → excluded.
    expect(applyFilters(arbitrages, { categories: new Set(['Currency']) })).toHaveLength(0)
    // Undefined categories means no filtering.
    expect(applyFilters(arbitrages, {})).toHaveLength(1)
  })
})
