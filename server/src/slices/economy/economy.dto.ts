import type { EconomySnapshot } from '@poe2-dashboard/shared'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import type { economyCurrencies, economyEdges, economySnapshots } from './economy.schema.js'

export type EconomySnapshotRow = InferSelectModel<typeof economySnapshots>
export type NewEconomySnapshotRow = InferInsertModel<typeof economySnapshots>
export type EconomyEdgeRow = InferSelectModel<typeof economyEdges>
export type NewEconomyEdgeRow = InferInsertModel<typeof economyEdges>
export type EconomyCurrencyRow = InferSelectModel<typeof economyCurrencies>
export type NewEconomyCurrencyRow = InferInsertModel<typeof economyCurrencies>

/** The relational read shape: a snapshot row with its children loaded. */
export type EconomySnapshotRowWithChildren = EconomySnapshotRow & {
  edges: EconomyEdgeRow[]
  currencies: EconomyCurrencyRow[]
}

/** Rows → the shared snapshot shape: rebuild the value/icon maps from non-null columns. */
export const toEconomySnapshot = (row: EconomySnapshotRowWithChildren): EconomySnapshot => {
  const currencyValues: EconomySnapshot['currencyValues'] = {}
  const currencyIcons: EconomySnapshot['currencyIcons'] = {}
  for (const currency of row.currencies) {
    if (currency.value !== null) currencyValues[currency.name] = currency.value
    if (currency.icon !== null) currencyIcons[currency.name] = currency.icon
  }
  return {
    league: row.league,
    fetchedAt: row.fetchedAt,
    edges: row.edges.map(({ from, to, rate, volume, category }) => ({
      from,
      to,
      rate,
      volume,
      category,
    })),
    currencyValues,
    currencyIcons,
    hubs: { divine: row.hubDivine, exalted: row.hubExalted, chaos: row.hubChaos },
  }
}

export const toSnapshotRow = (snapshot: EconomySnapshot): NewEconomySnapshotRow => ({
  league: snapshot.league,
  fetchedAt: snapshot.fetchedAt,
  hubDivine: snapshot.hubs.divine,
  hubExalted: snapshot.hubs.exalted,
  hubChaos: snapshot.hubs.chaos,
})

export const toEdgeRows = (snapshot: EconomySnapshot): NewEconomyEdgeRow[] =>
  snapshot.edges.map(edge => ({ league: snapshot.league, ...edge }))

/** Merge the value/icon maps into one row per currency (either side may be absent). */
export const toCurrencyRows = (snapshot: EconomySnapshot): NewEconomyCurrencyRow[] => {
  const names = new Set([
    ...Object.keys(snapshot.currencyValues),
    ...Object.keys(snapshot.currencyIcons),
  ])
  return [...names].map(name => ({
    league: snapshot.league,
    name,
    value: snapshot.currencyValues[name] ?? null,
    icon: snapshot.currencyIcons[name] ?? null,
  }))
}
