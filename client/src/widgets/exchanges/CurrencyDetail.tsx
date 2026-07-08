import type { Arbitrage, HubPrices } from '@poe2-dashboard/shared'
import { HUB_KEYS } from '@poe2-dashboard/shared'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useArbitragesQuery } from '@/api.js'
import { SectionLabel } from '@/components/common/SectionLabel.js'
import { cn } from '@/lib/utils'

import { CurrencyIcon } from '../arbitrage/CurrencyIcon.js'
import { CyclePayoff } from '../arbitrage/CyclePayoff.js'
import { cycleKey, formatCompact } from '../arbitrage/utils.js'

type Mode = 'buy' | 'sell'

// Both directions are stored in Divine terms, so the winner is a straight min
// (cheapest to acquire) or max (most received) across the three hubs.
const isBetter = (mode: Mode, a: number, b: number): boolean => (mode === 'buy' ? a < b : a > b)

const bestHub = (mode: Mode, prices: HubPrices): (typeof HUB_KEYS)[number] | null => {
  let winner: (typeof HUB_KEYS)[number] | null = null
  for (const key of HUB_KEYS) {
    const price = prices[key]
    if (price === null) continue
    if (winner === null || isBetter(mode, price, prices[winner]!)) winner = key
  }
  return winner
}

type CurrencyDetailProps = {
  /** The picked currency (guaranteed non-empty; the parent renders the empty state). */
  selected: string
  mode: Mode
  onModeChange: (mode: Mode) => void
}

/**
 * The Explorer's detail pane for one currency: what it costs to buy (or what you
 * receive to sell) across the three anchor hubs, plus every arbitrage cycle it
 * participates in. The hub comparison is the old "Rates" tab; the cycle list is
 * the per-currency slice of the arbitrage data, each row expandable into the same
 * payoff calculator the Browse table uses. Both read the client-derived economy,
 * so they're unaffected by the Browse tab's profit/volume thresholds.
 */
export const CurrencyDetail = ({ selected, mode, onModeChange }: CurrencyDetailProps) => {
  const { arbitrages } = useArbitragesQuery()
  const { bestBuy, bestSell, hubs, currencyValues } = arbitrages

  const prices = mode === 'buy' ? bestBuy[selected] : bestSell[selected]
  const winner = prices ? bestHub(mode, prices) : null
  const bestPrice = winner && prices ? prices[winner]! : null

  // Every cycle this currency is a leg of, richest first. Unfiltered by the Browse
  // tab's thresholds — here you want the full picture of what the currency can do.
  const cycles = useMemo(
    () =>
      arbitrages.arbitrages
        .filter(arb => arb.cycle.includes(selected))
        .sort((a, b) => b.profitPct - a.profitPct),
    [arbitrages.arbitrages, selected],
  )

  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <CurrencyIcon name={selected} className="h-8 w-8" />
        <h2 className="text-lg font-medium">{selected}</h2>
        <div className="ml-auto flex gap-0.5 rounded-lg bg-muted/50 p-0.5">
          {(['buy', 'sell'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors',
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{mode === 'buy' ? 'Cost to buy 1' : 'Received to sell 1'}</SectionLabel>
        <ul className="flex flex-col gap-1.5">
          {HUB_KEYS.map(key => {
            const hubName = hubs[key]
            const price = prices?.[key] ?? null
            const hubValue = currencyValues[hubName] ?? 0
            const isWinner = key === winner
            // Native hub units (Chaos per X, etc.) — what you actually pay/receive.
            const hubUnits = price !== null && hubValue > 0 ? price / hubValue : null
            // How much worse than the best hub, in Divine terms (0 for the winner).
            const worsePct =
              price !== null && bestPrice
                ? mode === 'buy'
                  ? (price / bestPrice - 1) * 100
                  : (1 - price / bestPrice) * 100
                : null

            return (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2',
                  isWinner ? 'border-green-400/40 bg-green-400/5' : 'border-border',
                  price === null && 'opacity-50',
                )}
              >
                <CurrencyIcon name={hubName} className="h-6 w-6" />
                <span className="text-sm">{hubName}</span>
                <span className="ml-auto flex items-center gap-2 tabular-nums">
                  {hubUnits === null ? (
                    <span className="text-sm text-muted-foreground">no route</span>
                  ) : (
                    <span className="text-sm">
                      {formatCompact(hubUnits)}{' '}
                      <span className="text-muted-foreground">/ {selected}</span>
                    </span>
                  )}
                  {isWinner ? (
                    <span className="rounded bg-green-400/10 px-1.5 py-0.5 text-[11px] font-medium text-green-400">
                      best
                    </span>
                  ) : (
                    worsePct !== null && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        −{worsePct.toFixed(1)}%
                      </span>
                    )
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Rates in each hub&rsquo;s own units; the winner is the best value in Divine terms
          {mode === 'buy' ? ' (cheapest to acquire).' : ' (most received).'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>
          Arbitrage cycles <span className="text-muted-foreground">({cycles.length})</span>
        </SectionLabel>
        {cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No arbitrage cycles route through {selected} in the current snapshot.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {cycles.map(cycle => (
              <CycleRow
                key={cycleKey(cycle)}
                cycle={cycle}
                currencyValues={currencyValues}
                expanded={expanded === cycleKey(cycle)}
                onToggle={() =>
                  setExpanded(prev => (prev === cycleKey(cycle) ? null : cycleKey(cycle)))
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

type CycleRowProps = {
  cycle: Arbitrage
  currencyValues: Record<string, number>
  expanded: boolean
  onToggle: () => void
}

// One cycle in the list: a summary row (the three currencies, profit %, and
// bottleneck volume) that expands into the payoff calculator for that cycle.
const CycleRow = ({ cycle, currencyValues, expanded, onToggle }: CycleRowProps) => {
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {cycle.cycle.map((name, i) => (
            <span key={name} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <CurrencyIcon name={name} className="h-5 w-5" />
              <span className="truncate text-sm">{name}</span>
            </span>
          ))}
        </span>
        <span className="shrink-0 rounded bg-green-400/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-green-400">
          +{cycle.profitPct.toFixed(1)}%
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          vol {formatCompact(cycle.minVolume)}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border p-3">
          <CyclePayoff arb={cycle} currencyValues={currencyValues} />
        </div>
      )}
    </li>
  )
}
