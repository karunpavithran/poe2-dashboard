import type { Arbitrage } from '@poe2-dashboard/shared'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'

import { sectionLabelClass } from '@/components/common/SectionLabel.js'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { CurrencyIcon } from './CurrencyIcon.js'
import {
  cycleKey,
  cycleThroughputDivine,
  estimateGoldCostDivine,
  formatCompact,
  formatRateAmount,
  normalizeRate,
} from './utils.js'

// A leg as the user is editing it: `spent`/`received` hold the discrete
// quantities the user actually traded — the market `rate` only seeds them and
// stays around as a reference. Every figure below is computed from spent/received.
type EditableLeg = {
  id: string
  from: string
  to: string
  /** Market rate (`to` per `from`) when the cycle was selected — display reference only. */
  rate: number
  /** This leg's per-market daily volume in Divines — display-only demand signal. */
  volume: number
  spent: number
  received: number
}

// Seed each leg from the same normalized rate the table shows (e.g. "118
// Artificer → 1 Divine"), so a freshly selected cycle reads identically in both
// places; the user then overwrites the amounts with what the trades filled at.
const seedLegs = (arb: Arbitrage): EditableLeg[] =>
  arb.legs.map(leg => {
    const [spent, received] = normalizeRate(leg.rate)
    return {
      id: `${leg.from}>${leg.to}`,
      from: leg.from,
      to: leg.to,
      rate: leg.rate,
      volume: leg.volume,
      // Currency items are discrete, so seed (and edit) in whole units.
      spent: Math.round(spent),
      received: Math.round(received),
    }
  })

// The unit every payoff is totalled in; its Divine value is 1.
const DIVINE_ORB = 'Divine Orb'

// The market rate (`to` per `from`) in the same normalized orientation the table
// uses, plus this leg's daily volume — a muted reference tucked into each leg's
// header. The volume makes a dead leg obvious right where the cycle is evaluated.
const MarketRate = ({ rate, volume }: { rate: number; volume: number }) => {
  const [from, to] = normalizeRate(rate)
  return (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      market {formatRateAmount(from)} → {formatRateAmount(to)} · vol {formatCompact(volume)}
    </span>
  )
}

type DeltaBadgeProps = {
  spent: number
  received: number
  /** Market rate (`to` per `from`) to compare the trade against. */
  rate: number
}

// How your fill rate (received per spent) compares to the market rate, as a
// signed %. Green when you beat the market, red when you came up short; a 0.5%
// band keeps integer-rounding noise neutral.
const DeltaBadge = ({ spent, received, rate }: DeltaBadgeProps) => {
  const effective = received / spent
  if (!Number.isFinite(effective) || effective <= 0) return null
  const diff = (effective - rate) / rate
  const color =
    diff > 0.005
      ? 'bg-green-400/10 text-green-400'
      : diff < -0.005
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums', color)}>
      {diff >= 0 ? '+' : ''}
      {(diff * 100).toFixed(1)}%
    </span>
  )
}

const numberFieldClass = cn(
  'h-7 w-24 text-right text-sm tabular-nums [appearance:textfield]',
  '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
)

type CyclePayoffProps = {
  /** The cycle to model — always present (the caller handles the empty state). */
  arb: Arbitrage
  /** Currency name → Divine value, for totalling the net across currencies. */
  currencyValues: Record<string, number>
}

/**
 * The payoff editor for a single arbitrage cycle: seed each leg from its market
 * rate, let the user overwrite the amounts they actually traded, and total the
 * net in Divines. Presentational and self-contained — it takes the cycle + value
 * map as props, so both the Browse table's calculator and the Currency Explorer's
 * inline expansion render the same thing.
 */
export const CyclePayoff = ({ arb, currencyValues }: CyclePayoffProps) => {
  const [legs, setLegs] = useState<EditableLeg[]>(() => seedLegs(arb))
  // Re-seed only when the cycle itself changes — not on every background refresh —
  // so an in-flight refetch never clobbers the amounts the user typed.
  const [seededKey, setSeededKey] = useState<string>(() => cycleKey(arb))
  const key = cycleKey(arb)
  if (key !== seededKey) {
    setSeededKey(key)
    setLegs(seedLegs(arb))
  }

  const netByCurrency = useMemo(() => {
    const totals = new Map<string, number>()
    for (const leg of legs) {
      totals.set(leg.from, (totals.get(leg.from) ?? 0) - leg.spent)
      totals.set(leg.to, (totals.get(leg.to) ?? 0) + leg.received)
    }
    return totals
  }, [legs])

  const updateLeg = (id: string, field: 'spent' | 'received', value: number) =>
    setLegs(current => current.map(leg => (leg.id === id ? { ...leg, [field]: value } : leg)))

  const moveLeg = (index: number, direction: -1 | 1) =>
    setLegs(current => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (!moved) return current
      next.splice(target, 0, moved)
      return next
    })

  // Total payoff in Divines: value each currency's net at its mid Divine value
  // and sum, so leftover amounts in the intermediate currencies count too. The
  // capital at risk — the entry spend into cycle[0], in Divines — anchors the %.
  const startCurrency = arb.cycle[0]
  const profit = [...netByCurrency].reduce(
    (total, [name, net]) => total + net * (currencyValues[name] ?? 0),
    0,
  )
  const entrySpent = legs.find(leg => leg.from === startCurrency)?.spent ?? 0
  const investedDivine = entrySpent * (currencyValues[startCurrency] ?? 0)
  const profitPct = investedDivine > 0 ? (profit / investedDivine) * 100 : 0

  // Market-depth metrics for the cycle (independent of the amounts the user
  // typed): the most Divines/day this cycle can yield at current liquidity, and
  // the gold fee that throughput is already net of (0 until modeled).
  const throughput = cycleThroughputDivine(arb)
  const goldCost = estimateGoldCostDivine(arb)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {legs.map((leg, index) => (
          <div key={leg.id} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Leg {index + 1}</span>
              <MarketRate rate={leg.rate} volume={leg.volume} />
              <div className="flex gap-0.5">
                <button
                  type="button"
                  aria-label="Move leg earlier"
                  disabled={index === 0}
                  onClick={() => moveLeg(index, -1)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move leg later"
                  disabled={index === legs.length - 1}
                  onClick={() => moveLeg(index, 1)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Spend</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={leg.spent}
                onChange={event =>
                  updateLeg(leg.id, 'spent', Math.round(Number(event.target.value)))
                }
                className={numberFieldClass}
              />
              <CurrencyIcon name={leg.from} className="h-6 w-6" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <DeltaBadge spent={leg.spent} received={leg.received} rate={leg.rate} />
              <span className="ml-auto text-xs text-muted-foreground">Get</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={leg.received}
                onChange={event =>
                  updateLeg(leg.id, 'received', Math.round(Number(event.target.value)))
                }
                className={numberFieldClass}
              />
              <CurrencyIcon name={leg.to} className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Profit</span>
          <span
            className={cn(
              'flex items-center gap-1.5 font-medium tabular-nums',
              profit >= 0 ? 'text-green-400' : 'text-destructive',
            )}
          >
            {profit >= 0 ? '+' : ''}
            {profit.toFixed(2)}
            <CurrencyIcon name={DIVINE_ORB} className="h-5 w-5" />
            <span>({profitPct.toFixed(2)}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Profit / day at depth</span>
          <span className="flex items-center gap-1.5 tabular-nums text-green-400">
            {formatCompact(throughput)}
            <CurrencyIcon name={DIVINE_ORB} className="h-5 w-5" />
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Gold cost</span>
          <span className="tabular-nums text-muted-foreground">
            {goldCost > 0 ? formatCompact(goldCost) : '—'}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <p className={sectionLabelClass}>Net by currency</p>
          {[...netByCurrency].map(([name, net]) => {
            const isZero = Math.abs(net) < 1e-9
            return (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <CurrencyIcon name={name} className="h-5 w-5" />
                  <span className="truncate">{name}</span>
                </span>
                <span
                  className={cn(
                    'tabular-nums',
                    isZero
                      ? 'text-muted-foreground'
                      : net > 0
                        ? 'text-green-400'
                        : 'text-destructive',
                  )}
                >
                  {net > 0 ? '+' : ''}
                  {formatRateAmount(net)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
