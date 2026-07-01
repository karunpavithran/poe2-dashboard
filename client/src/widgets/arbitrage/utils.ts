import type { Arbitrage } from '@poe2-dashboard/shared'

/** Stable identity for a cycle — used as a React key and as the selection handle. */
export const cycleKey = (arb: Arbitrage): string => arb.cycle.join('>')

/**
 * Pluggable hook for the PoE2 currency-exchange gold fee, in Divine-equivalent
 * units. Every exchange burns gold that scales with the currency's rarity and
 * the amount traded, so a thin high-% cycle can cost more gold than it earns.
 * poe.ninja gives us no gold data yet, so this returns 0 today — it's the single
 * place to implement the real fee once a gold-cost source lands, and every
 * throughput figure below becomes gold-aware automatically.
 */
export const estimateGoldCostDivine = (_: Arbitrage): number => 0

/**
 * The cycle's "total currency gained" signal in Divines: round-trip profit
 * applied to the most capital the thinnest leg can absorb in a day
 * (`minVolume`), net of the gold fee. Biases toward trades whose absolute payoff
 * is large enough to dwarf the per-execution gold cost, rather than trades that
 * merely show a high percentage on a near-dead market.
 */
export const cycleThroughputDivine = (arb: Arbitrage): number =>
  (arb.profitPct / 100) * arb.minVolume - estimateGoldCostDivine(arb)

/**
 * Compact number for volumes/Divine totals that span ~0.002 → 176000: small
 * values keep 2 sig-figs, thousands collapse to "1.2k"/"176k". Distinct from
 * `formatRateAmount`, which is tuned for per-leg trade rates and doesn't abbreviate.
 */
export const formatCompact = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1000) return `${(value / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  if (abs >= 10) return String(Math.round(value))
  if (abs >= 1) return value.toFixed(1)
  if (abs === 0) return '0'
  return value.toFixed(2)
}

export const formatRateAmount = (value: number): string =>
  Number.isInteger(value)
    ? String(value)
    : value < 10
      ? value.toFixed(2)
      : String(Math.round(value))

// A leg's rate as a [fromAmount, toAmount] pair, oriented so the larger side is
// normalized to 1 ("118 Artificer → 1 Divine" rather than "1 Artificer → 0.0085 Divine")
export const normalizeRate = (rate: number): [number, number] =>
  rate >= 1 ? [1, rate] : [1 / rate, 1]

function pipe<A, B>(ab: (a: A) => B): (a: A) => B
function pipe<A, B, C>(ab: (a: A) => B, bc: (b: B) => C): (a: A) => C
function pipe<A, B, C, D>(ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): (a: A) => D
function pipe(...fns: Array<(arg: unknown) => unknown>) {
  return (x: unknown) => fns.reduce((acc, fn) => fn(acc), x)
}

export const formatRate = pipe(
  (rate: number) => normalizeRate(rate),
  ([fromAmt, toAmt]) => [formatRateAmount(fromAmt), formatRateAmount(toAmt)],
)
