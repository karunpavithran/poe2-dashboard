import { useMemo } from 'react'

import { useArbitrageContext, useArbitrages } from './context.js'
import { CyclePayoff } from './CyclePayoff.js'
import { cycleKey } from './utils.js'

/**
 * The Browse tab's payoff panel: resolve the table's selected cycle and hand it
 * to <CyclePayoff>. Resolution runs against the live (filtered) rows so the model
 * tracks background refreshes; if the cycle drops out of the current filters it
 * reads as deselected rather than freezing a stale snapshot. The Currency Explorer
 * renders <CyclePayoff> directly (one per expanded cycle), so this wrapper only
 * exists to bridge the table's `selectedCycleKey` selection model.
 */
export const PayoffCalculator = () => {
  const { selectedCycleKey } = useArbitrageContext()
  const { arbitrages } = useArbitrages()

  const selected = useMemo(
    () => arbitrages.arbitrages.find(arb => cycleKey(arb) === selectedCycleKey) ?? null,
    [arbitrages.arbitrages, selectedCycleKey],
  )

  if (!selected) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Select a cycle from the table to calculate its payoff.
      </p>
    )
  }

  return <CyclePayoff arb={selected} currencyValues={arbitrages.currencyValues} />
}
