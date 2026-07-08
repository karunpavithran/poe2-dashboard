import { buildGraph, findTriangularArbitrages } from '@poe2-dashboard/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PoeNinjaDetailsResponse, PoeNinjaOverviewResponse } from '../src/poeNinja.js'
import { buildEdges, fetchOverview } from '../src/poeNinja.js'

// Rates below are real observations captured June 12, 2026. The two
// directions of each pair were independently observed, so round trips lose
// the spread — but the divine->exalted->chaos->divine cross rates were
// genuinely inconsistent that day (~+7.3%).
const items = [
  { id: 'divine', name: 'Divine Orb', detailsId: 'divine-orb' },
  { id: 'exalted', name: 'Exalted Orb', detailsId: 'exalted-orb' },
  { id: 'chaos', name: 'Chaos Orb', detailsId: 'chaos-orb' },
  { id: 'alch', name: 'Orb of Alchemy', detailsId: 'orb-of-alchemy' },
]

const overview: PoeNinjaOverviewResponse = {
  core: {
    items: items.slice(0, 3),
    rates: { exalted: 128.4, chaos: 10.1 },
    primary: 'divine',
    secondary: 'exalted',
  },
  lines: [
    {
      id: 'exalted',
      primaryValue: 0.007785,
      volumePrimaryValue: 176460,
      maxVolumeCurrency: 'divine',
      maxVolumeRate: 128.4,
    },
    {
      id: 'chaos',
      primaryValue: 0.099,
      volumePrimaryValue: 87070,
      maxVolumeCurrency: 'divine',
      maxVolumeRate: 10.1,
    },
    {
      id: 'divine',
      primaryValue: 1,
      volumePrimaryValue: 176460,
      maxVolumeCurrency: 'exalted',
      maxVolumeRate: 0.007785,
    },
    {
      id: 'alch',
      primaryValue: 0.004042,
      volumePrimaryValue: 494.2,
      maxVolumeCurrency: 'exalted',
      maxVolumeRate: 1.93,
    },
  ],
  items,
}

function details(
  id: string,
  pairs: { id: string; rate: number; volumePrimaryValue: number }[],
): PoeNinjaDetailsResponse {
  const item = items.find(i => i.id === id)!
  return { item, pairs, core: overview.core }
}

const detailsList = [
  details('divine', [
    { id: 'exalted', rate: 128.4, volumePrimaryValue: 176460 },
    { id: 'chaos', rate: 10.1, volumePrimaryValue: 87070 },
  ]),
  details('exalted', [
    { id: 'divine', rate: 0.007745, volumePrimaryValue: 179652 },
    { id: 'chaos', rate: 0.08467, volumePrimaryValue: 16212 },
  ]),
  details('chaos', [
    { id: 'divine', rate: 0.09873, volumePrimaryValue: 86949 },
    { id: 'exalted', rate: 11.81, volumePrimaryValue: 15020 },
  ]),
  details('alch', [
    { id: 'divine', rate: 0.00478, volumePrimaryValue: 265 },
    { id: 'exalted', rate: 0.5137, volumePrimaryValue: 491.9 },
    { id: 'chaos', rate: 0.05084, volumePrimaryValue: 45.7 },
  ]),
]

describe('buildEdges', () => {
  const edges = buildEdges(overview, detailsList, 'Currency')

  it('tags every edge with the category it was built from', () => {
    expect(edges.every(e => e.category === 'Currency')).toBe(true)
  })

  it('uses only observed rates — both directions of a pair differ by the spread', () => {
    const divToEx = edges.find(e => e.from === 'Divine Orb' && e.to === 'Exalted Orb')
    const exToDiv = edges.find(e => e.from === 'Exalted Orb' && e.to === 'Divine Orb')
    expect(divToEx?.rate).toBeCloseTo(128.4)
    expect(exToDiv?.rate).toBeCloseTo(0.007745)
    // Round trip loses the real spread, not exactly 1.
    expect(divToEx!.rate * exToDiv!.rate).toBeLessThan(1)
    expect(divToEx!.rate * exToDiv!.rate).toBeGreaterThan(0.98)
  })

  it('never fabricates a direction by inverting', () => {
    // Nothing observed sells chaos for alch, so that edge must not exist.
    expect(edges.some(e => e.from === 'Chaos Orb' && e.to === 'Orb of Alchemy')).toBe(false)
    // But exalted -> alch is observed via the overview maxVolumeRate.
    const exToAlch = edges.find(e => e.from === 'Exalted Orb' && e.to === 'Orb of Alchemy')
    expect(exToAlch?.rate).toBeCloseTo(1.93)
  })

  it('uses the specific market volume for the maxVolume edge, not the line aggregate', () => {
    // alch's line volume is the busiest-market figure (494.2), but the
    // exalted<->alch market's real volume comes from alch's details page (491.9).
    // The inbound exalted -> alch edge must carry the per-market figure.
    const exToAlch = edges.find(e => e.from === 'Exalted Orb' && e.to === 'Orb of Alchemy')
    expect(exToAlch?.volume).toBeCloseTo(491.9)
  })

  it('falls back to the line volume when no detail pair matches the maxVolume market', () => {
    // A currency whose details page lacks the maxVolumeCurrency pair keeps the
    // overview line volume rather than dropping to zero.
    const orphanOverview: PoeNinjaOverviewResponse = {
      ...overview,
      lines: [
        {
          id: 'alch',
          primaryValue: 0.004042,
          volumePrimaryValue: 494.2,
          maxVolumeCurrency: 'exalted',
          maxVolumeRate: 1.93,
        },
      ],
    }
    const orphanEdges = buildEdges(orphanOverview, [details('alch', [])], 'Currency')
    const exToAlch = orphanEdges.find(e => e.from === 'Exalted Orb' && e.to === 'Orb of Alchemy')
    expect(exToAlch?.volume).toBeCloseTo(494.2)
  })

  it('detects the real divine -> exalted -> chaos cross-rate inconsistency', () => {
    const graph = buildGraph(edges)
    const arbitrages = findTriangularArbitrages(graph, 0.01)
    const hubCycle = arbitrages.find(
      o =>
        o.cycle.includes('Divine Orb') &&
        o.cycle.includes('Exalted Orb') &&
        o.cycle.includes('Chaos Orb'),
    )
    // 128.4 * 0.08467 * 0.09873 = 1.0733
    expect(hubCycle).toBeDefined()
    expect(hubCycle!.profitPct).toBeCloseTo(7.33, 1)
    // The reverse direction is lossy and must not be reported.
    const reverse = arbitrages.filter(
      o =>
        o.cycle.includes('Divine Orb') &&
        o.cycle.includes('Exalted Orb') &&
        o.cycle.includes('Chaos Orb'),
    )
    expect(reverse).toHaveLength(1)
  })
})

describe('ninjaFetch 429 handling (via fetchOverview)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const emptyOverview = {
    core: { items: [], rates: {}, primary: 'divine', secondary: 'exalted' },
    lines: [],
    items: [],
  }

  it('backs off on a 429 (honoring Retry-After) and retries to success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '2' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(emptyOverview), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = fetchOverview('Test League', 'Currency')
    await vi.runAllTimersAsync()
    const overview = await pending

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(overview.lines).toEqual([])
  })
})
