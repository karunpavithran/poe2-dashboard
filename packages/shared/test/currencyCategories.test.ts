import { describe, expect, it } from 'vitest'

import { computeCurrencyCategories } from '../src/currencyCategories.js'
import type { ExchangeType, HubNames, RateEdge } from '../src/index.js'

const edge = (from: string, to: string, category: ExchangeType): RateEdge => ({
  from,
  to,
  rate: 1,
  volume: 100,
  category,
})

const HUBS: HubNames = { divine: 'Div', exalted: 'Exa', chaos: 'Cha' }

describe('computeCurrencyCategories', () => {
  it("attributes each non-hub endpoint the edge's category", () => {
    // An Essence is listed on the Essences page (traded against Chaos); a Rune on Runes.
    const result = computeCurrencyCategories(
      [edge('Cha', 'Ess', 'Essences'), edge('Rune', 'Div', 'Runes')],
      HUBS,
    )
    expect(result.Ess).toEqual(['Essences'])
    expect(result.Rune).toEqual(['Runes'])
  })

  it('excludes the anchor hubs', () => {
    const result = computeCurrencyCategories([edge('Cha', 'Ess', 'Essences')], HUBS)
    expect(result.Cha).toBeUndefined()
    expect(result.Div).toBeUndefined()
    expect(result.Exa).toBeUndefined()
  })

  it('collects multiple categories for a currency listed on more than one page', () => {
    const result = computeCurrencyCategories(
      [edge('Cha', 'X', 'Currency'), edge('X', 'Div', 'Fragments')],
      HUBS,
    )
    // Emitted in canonical EXCHANGE_TYPES order (Currency before Fragments), deduped.
    expect(result.X).toEqual(['Currency', 'Fragments'])
  })

  it('dedupes a category seen across several edges of the same currency', () => {
    const result = computeCurrencyCategories(
      [edge('Cha', 'X', 'Runes'), edge('Div', 'X', 'Runes'), edge('X', 'Exa', 'Runes')],
      HUBS,
    )
    expect(result.X).toEqual(['Runes'])
  })
})
