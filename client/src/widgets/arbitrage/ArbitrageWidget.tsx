import { Loader2, X } from 'lucide-react'

import { useRefreshArbitrages } from '@/api.js'
import { DataAge } from '@/components/common/DataAge.js'
import { sectionLabelClass } from '@/components/common/SectionLabel.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { ArbitrageTable } from './ArbitrageTable.js'
import { useArbitrageContext, useArbitrages } from './context.js'
import { FilterToolbar } from './FilterToolbar.js'
import { PayoffCalculator } from './PayoffCalculator.js'

const ArbitrageCard = () => {
  const { arbitrages, isArbitragesFetching } = useArbitrages()
  const { dataAgeMs, lastError, isRefreshing } = arbitrages
  const { selectedCycleKey, setSelectedCycleKey } = useArbitrageContext()
  const refresh = useRefreshArbitrages()

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-3">
        <CardTitle>Arbitrage</CardTitle>
        {dataAgeMs === null ? (
          // No snapshot yet — the error banner covers the failed-poll case, so
          // only show the loading hint while we're genuinely still waiting.
          !lastError && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Fetching rates from poe.ninja…
            </span>
          )
        ) : (
          <DataAge
            fetchedAt={Date.now() - dataAgeMs}
            onRefetch={() => refresh.mutate()}
            isFetching={isRefreshing || refresh.isPending || isArbitragesFetching}
          />
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {lastError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-sm mb-3">
            Last poll failed: {lastError}
          </p>
        )}
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
      </CardContent>
    </Card>
  )
}

export const ArbitrageWidget = () => <ArbitrageCard />
