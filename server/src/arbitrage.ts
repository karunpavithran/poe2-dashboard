import type { Arbitrage, ArbitrageLeg } from '@poe2-dashboard/shared'

import type { RateGraph } from './graph.js'

/**
 * Brute-force all ordered triples (A, B, C) of distinct currencies and report
 * cycles where rate(A->B) * rate(B->C) * rate(C->A) exceeds 1 + threshold.
 *
 * Rotations of the same cycle ((A,B,C), (B,C,A), (C,A,B)) are the same trade,
 * so each cycle is emitted once, canonicalized to start at its
 * lexicographically smallest currency. The two directions around a triangle
 * are distinct trades (rates are asymmetric) and are reported separately.
 *
 * With a few dozen PoE2 currencies this is at most ~10^5 triples — no need
 * for Bellman-Ford.
 */

/** Rotate (a, b, c) so the lexicographically smallest currency leads, preserving direction. */
const canonicalize = (a: string, b: string, c: string): [string, string, string] => {
  if (a <= b && a <= c) return [a, b, c]
  if (b <= a && b <= c) return [b, c, a]
  return [c, a, b]
}

/** Rotate the legs to match the canonicalized cycle's starting currency. */
const orderLegs = (
  start: string,
  legs: ArbitrageLeg[],
): [ArbitrageLeg, ArbitrageLeg, ArbitrageLeg] => {
  const i = legs.findIndex(l => l.from === start)
  return [legs[i]!, legs[(i + 1) % 3]!, legs[(i + 2) % 3]!]
}

export const findTriangularArbitrages = (graph: RateGraph, threshold = 0): Arbitrage[] => {
  const currencies = [...graph.keys()]
  const seen = new Set<string>()
  const arbitrages: Arbitrage[] = []

  for (const a of currencies) {
    const fromA = graph.get(a)!
    for (const [b, legAB] of fromA) {
      if (b === a) continue
      const fromB = graph.get(b)
      if (!fromB) continue
      for (const [c, legBC] of fromB) {
        if (c === a || c === b) continue
        const legCA = graph.get(c)?.get(a)
        if (!legCA) continue

        const cycle = canonicalize(a, b, c)
        const key = cycle.join('>')
        if (seen.has(key)) continue
        seen.add(key)

        const multiplier = legAB.rate * legBC.rate * legCA.rate
        if (multiplier <= 1 + threshold) continue

        const legs = orderLegs(cycle[0], [legAB, legBC, legCA])
        arbitrages.push({
          cycle,
          multiplier,
          profitPct: (multiplier - 1) * 100,
          legs,
          minVolume: Math.min(legAB.volume, legBC.volume, legCA.volume),
        })
      }
    }
  }

  return arbitrages.sort((x, y) => y.profitPct - x.profitPct)
}
