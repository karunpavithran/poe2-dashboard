import { X } from 'lucide-react'

import { sectionLabelClass } from '@/components/common/SectionLabel.js'

import { ArbitrageTable } from './ArbitrageTable.js'
import { useArbitrageContext } from './context.js'
import { FilterToolbar } from './FilterToolbar.js'
import { PayoffCalculator } from './PayoffCalculator.js'

/**
 * The "Arbitrage" submodule of the Exchanges widget: the filter toolbar, the
 * cycle table, and the slide-in payoff calculator. The Card shell, freshness
 * badge, and poll-error banner live one level up in ExchangesWidget (shared with
 * the Rates tab), so this renders only the body inside that shell's CardContent.
 */
export const ArbitrageTab = () => {
  const { selectedCycleKey, setSelectedCycleKey } = useArbitrageContext()

  return (
    <>
      <div className="mb-3">
        <FilterToolbar />
      </div>
      <div className="flex-1 min-h-0 flex gap-4">
        <div className="flex-1 min-h-0 overflow-auto">
          <ArbitrageTable />
        </div>
        {selectedCycleKey !== null && (
          <div className="w-80 shrink-0 overflow-auto border-l border-border pl-4">
            <div className="mb-3 flex items-center justify-between">
              <p className={sectionLabelClass}>Payoff Calculator</p>
              <button
                type="button"
                aria-label="Close calculator"
                onClick={() => setSelectedCycleKey(null)}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PayoffCalculator />
          </div>
        )}
      </div>
    </>
  )
}
